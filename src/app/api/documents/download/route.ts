import { NextResponse } from "next/server";
import { s3Client } from "@/lib/s3-r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getPresignedDownloadUrl } from "@/lib/s3-r2";
import { prisma } from "@/lib/prisma";
import { 
  extractGoogleDriveFileId, 
  downloadDriveFileBuffer, 
  getDriveFileMetadata 
} from "@/lib/drive-utils";
import { 
  formatStandardDocumentFileName,
  getMimeTypeFromFilenameOrBuffer 
} from "@/lib/mime-utils";
import { Readable } from "stream";

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "repol-academic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const documentId = searchParams.get("id");
    const customUrl = searchParams.get("url");
    const customName = searchParams.get("name");
    const mode = searchParams.get("mode"); // 'stream', 'redirect', 'download', 'inline'
    const isDownload = searchParams.get("download") === "true" || mode === "download";

    let targetKey = key;
    let docTitle = customName || "";
    let docFileUrl = customUrl || "";
    let docMimeType = "";
    let docYear: number | null = null;
    let docTerm: string | null = null;
    let docSubjectCode: string | null = null;

    // Si pasaron documentId o key, buscar en la base de datos
    if (documentId) {
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { 
          id: true, 
          title: true, 
          storageKey: true, 
          fileUrl: true, 
          mimeType: true,
          periodYear: true,
          periodTerm: true,
          subject: { select: { code: true } }
        },
      });

      if (doc) {
        targetKey = doc.storageKey;
        docTitle = doc.title;
        docFileUrl = doc.fileUrl;
        docMimeType = doc.mimeType || "";
        docYear = doc.periodYear;
        docTerm = doc.periodTerm;
        docSubjectCode = doc.subject?.code || null;

        if (isDownload) {
          prisma.document
            .update({
              where: { id: doc.id },
              data: { downloadCount: { increment: 1 } },
            })
            .catch((err) => console.warn("Error incrementando downloadCount:", err));
        }
      }
    } else if (targetKey) {
      const doc = await prisma.document.findFirst({
        where: { storageKey: targetKey },
        select: { 
          id: true, 
          title: true, 
          storageKey: true, 
          fileUrl: true, 
          mimeType: true,
          periodYear: true,
          periodTerm: true,
          subject: { select: { code: true } }
        },
      });

      if (doc) {
        docTitle = doc.title;
        docFileUrl = doc.fileUrl;
        docMimeType = doc.mimeType || "";
        docYear = doc.periodYear;
        docTerm = doc.periodTerm;
        docSubjectCode = doc.subject?.code || null;

        if (isDownload) {
          prisma.document
            .update({
              where: { id: doc.id },
              data: { downloadCount: { increment: 1 } },
            })
            .catch((err) => console.warn("Error incrementando downloadCount:", err));
        }
      }
    }

    if (!targetKey && !docFileUrl) {
      return NextResponse.json({ error: "Falta el parámetro 'key', 'id' o 'url' del documento" }, { status: 400 });
    }

    const dispositionType = isDownload ? "attachment" : "inline";

    // =========================================================================
    // CASO 1: Documento almacenado en GOOGLE DRIVE
    // =========================================================================
    const isGoogleDrive =
      targetKey?.startsWith("gdrive:") ||
      docFileUrl.includes("drive.google.com");

    if (isGoogleDrive) {
      const driveFileId =
        targetKey?.replace(/^gdrive:/, "") ||
        extractGoogleDriveFileId(docFileUrl);

      if (!driveFileId) {
        return NextResponse.json({ error: "ID de archivo de Google Drive no válido" }, { status: 400 });
      }

      // Si no es stream explícito, redirigir directamente al link de descarga de Google Drive
      // Esto consume 0 bytes de Fast Origin Transfer en Vercel
      if (mode !== "stream") {
        const driveDirectUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}&confirm=t`;
        return NextResponse.redirect(driveDirectUrl, { status: 307 });
      }

      // Obtener metadatos y buffer binario desde Google Drive (solo si se pide stream explícito)
      const [driveMeta, fileBuffer] = await Promise.all([
        getDriveFileMetadata(driveFileId),
        downloadDriveFileBuffer(driveFileId),
      ]);

      if (!fileBuffer) {
        console.error("Error al descargar buffer binario desde Google Drive para ID:", driveFileId);
        return NextResponse.json(
          { error: "No se pudo recuperar el archivo desde Google Drive. Asegúrate de que el archivo esté compartido públicamente." },
          { status: 502 }
        );
      }

      const effectiveTitle = docTitle || driveMeta?.name || "Documento";
      const effectiveMime = driveMeta?.mimeType || docMimeType || getMimeTypeFromFilenameOrBuffer(effectiveTitle, fileBuffer);
      const finalFilename = formatStandardDocumentFileName({
        title: effectiveTitle,
        year: docYear,
        term: docTerm,
        subjectCode: docSubjectCode,
        mimeType: effectiveMime,
        buffer: fileBuffer,
      });

      return new Response(new Uint8Array(fileBuffer), {
        headers: {
          "Content-Type": effectiveMime,
          "Content-Disposition": `${dispositionType}; filename="${encodeURIComponent(finalFilename)}"`,
          "Content-Length": fileBuffer.length.toString(),
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
        },
      });
    }

    // =========================================================================
    // CASO 2: Documento almacenado en CLOUDFLARE R2
    // =========================================================================
    const effectiveTitle = docTitle || targetKey || "documento";
    const contentType = docMimeType || getMimeTypeFromFilenameOrBuffer(effectiveTitle);
    const finalFilename = formatStandardDocumentFileName({
      title: effectiveTitle,
      year: docYear,
      term: docTerm,
      subjectCode: docSubjectCode,
      mimeType: contentType,
    });

    // Enviar una redirección directa (307) a la URL prefirmada de R2.
    // Esto hace que el navegador descargue directamente desde Cloudflare R2 con 0 costos de egress
    // y 0 bytes de Fast Origin Transfer en Vercel, salvo que se fuerce mode='stream'.
    if (mode !== "stream") {
      try {
        const presignedUrl = await getPresignedDownloadUrl(targetKey!, 3600, {
          responseContentDisposition: `${dispositionType}; filename="${encodeURIComponent(finalFilename)}"`,
          responseContentType: contentType,
        });
        return NextResponse.redirect(presignedUrl, { status: 307 });
      } catch (err) {
        console.warn("No se pudo generar presigned download URL para redirección, procediendo con fallback de streaming:", err);
      }
    }

    // Fallback: streaming a través de la función de Vercel
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: targetKey!,
    });

    const s3Response = await s3Client.send(command);

    if (!s3Response.Body) {
      return NextResponse.json({ error: "El archivo no existe en el almacenamiento" }, { status: 404 });
    }

    const streamContentType = s3Response.ContentType || contentType;
    const nodeStream = s3Response.Body as Readable;
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk: Buffer | Uint8Array) => controller.enqueue(chunk));
        nodeStream.on("end", () => controller.close());
        nodeStream.on("error", (err: Error) => controller.error(err));
      },
    });

    return new Response(webStream, {
      headers: {
        "Content-Type": streamContentType,
        "Content-Disposition": `${dispositionType}; filename="${encodeURIComponent(finalFilename)}"`,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
        ...(s3Response.ContentLength && {
          "Content-Length": s3Response.ContentLength.toString(),
        }),
      },
    });
  } catch (error: unknown) {
    console.error("Error al obtener documento para descarga:", error);
    const err = error as { name?: string; message?: string };
    if (err.name === "NoSuchKey" || err.message?.includes("NoSuchKey")) {
      return NextResponse.json({ error: "Documento no encontrado en el servidor." }, { status: 404 });
    }
    return NextResponse.json({ error: "Error al recuperar el archivo del servidor." }, { status: 500 });
  }
}
