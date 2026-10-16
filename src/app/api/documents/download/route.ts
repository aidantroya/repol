import { NextResponse } from "next/server";
import { s3Client } from "@/lib/s3-r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getPresignedDownloadUrl } from "@/lib/s3-r2";
import { prisma } from "@/lib/prisma";
import { 
  extractGoogleDriveFileId, 
  downloadDriveFileBuffer 
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

      const effectiveTitle = docTitle || "Documento";
      const keyLower = (targetKey || docFileUrl || "").toLowerCase();
      let detectedMime = docMimeType;
      if (keyLower.endsWith(".ipynb")) detectedMime = "application/x-ipynb+json";
      else if (keyLower.endsWith(".py")) detectedMime = "text/x-python";
      else if (keyLower.endsWith(".sql")) detectedMime = "text/x-sql";
      else if (keyLower.endsWith(".docx")) detectedMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      else if (keyLower.endsWith(".pptx")) detectedMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      else if (keyLower.endsWith(".xlsx")) detectedMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      const effectiveMime = detectedMime || getMimeTypeFromFilenameOrBuffer(effectiveTitle);
      const finalFilename = formatStandardDocumentFileName({
        title: effectiveTitle,
        year: docYear,
        term: docTerm,
        subjectCode: docSubjectCode,
        mimeType: effectiveMime,
        storageKey: targetKey,
        fileUrl: docFileUrl,
      });

      const DEFAULT_WATERMARK_WORKER_URL = "https://repol-pdf-stamper.aidantroya24.workers.dev";
      const watermarkWorkerUrl =
        process.env.WATERMARK_WORKER_URL ||
        process.env.NEXT_PUBLIC_WATERMARK_WORKER_URL ||
        DEFAULT_WATERMARK_WORKER_URL;

      // Redirigir la descarga al Worker:
      // Si es PDF, estampará el sello y el enlace oficial.
      // Si es Python, Jupyter, Word, etc., el Worker inspeccionará los bytes mágicos, corregirá el nombre y lo enviará intacto.
      if (isDownload && watermarkWorkerUrl && mode !== "stream") {
        const workerRedirectUrl = `${watermarkWorkerUrl.replace(/\/+$/, "")}?driveId=${driveFileId}&name=${encodeURIComponent(finalFilename)}`;
        return NextResponse.redirect(workerRedirectUrl, { status: 307 });
      }

      // Si no es stream explícito, redirigir directamente al link de descarga de Google Drive
      // Esto consume 0 bytes de Fast Origin Transfer en Vercel
      if (mode !== "stream") {
        const driveDirectUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}&confirm=t`;
        return NextResponse.redirect(driveDirectUrl, { status: 307 });
      }

      // Obtener buffer binario desde Google Drive (solo si se pide stream explícito)
      const fileBufferAsync = await downloadDriveFileBuffer(driveFileId);

      if (!fileBufferAsync) {
        console.error("Error al descargar buffer binario desde Google Drive para ID:", driveFileId);
        return NextResponse.json(
          { error: "No se pudo recuperar el archivo desde Google Drive. Asegúrate de que el archivo esté compartido públicamente." },
          { status: 502 }
        );
      }

      return new Response(new Uint8Array(fileBufferAsync), {
        headers: {
          "Content-Type": effectiveMime,
          "Content-Disposition": `${dispositionType}; filename="${encodeURIComponent(finalFilename)}"`,
          "Content-Length": fileBufferAsync.length.toString(),
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
        },
      });
    }

    // =========================================================================
    // CASO 2: Documento almacenado en CLOUDFLARE R2
    // =========================================================================
    const effectiveTitle = docTitle || targetKey || "documento";
    const r2KeyLower = (targetKey || "").toLowerCase();
    let r2DetectedMime = docMimeType;
    if (r2KeyLower.endsWith(".ipynb")) r2DetectedMime = "application/x-ipynb+json";
    else if (r2KeyLower.endsWith(".py")) r2DetectedMime = "text/x-python";
    else if (r2KeyLower.endsWith(".sql")) r2DetectedMime = "text/x-sql";
    else if (r2KeyLower.endsWith(".docx")) r2DetectedMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    else if (r2KeyLower.endsWith(".pptx")) r2DetectedMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    else if (r2KeyLower.endsWith(".xlsx")) r2DetectedMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    const contentType = r2DetectedMime || getMimeTypeFromFilenameOrBuffer(effectiveTitle);
    const finalFilename = formatStandardDocumentFileName({
      title: effectiveTitle,
      year: docYear,
      term: docTerm,
      subjectCode: docSubjectCode,
      mimeType: contentType,
      storageKey: targetKey,
      fileUrl: docFileUrl,
    });

    // Enviar una redirección directa (307) a la URL prefirmada de R2 o al Cloudflare Worker.
    // Esto hace que el navegador descargue directamente desde Cloudflare con 0 costos de egress
    // y 0 bytes de Fast Origin Transfer en Vercel, salvo que se fuerce mode='stream'.
    if (mode !== "stream") {
      try {
        const presignedUrl = await getPresignedDownloadUrl(targetKey!, 3600, {
          responseContentDisposition: `${dispositionType}; filename="${encodeURIComponent(finalFilename)}"`,
          responseContentType: contentType,
        });

        const isPdf =
          (contentType.includes("pdf") || finalFilename.toLowerCase().endsWith(".pdf")) &&
          !finalFilename.toLowerCase().endsWith(".ipynb") &&
          !finalFilename.toLowerCase().endsWith(".py") &&
          !finalFilename.toLowerCase().endsWith(".sql") &&
          !finalFilename.toLowerCase().endsWith(".docx") &&
          !finalFilename.toLowerCase().endsWith(".pptx") &&
          !finalFilename.toLowerCase().endsWith(".xlsx");

        const watermarkWorkerUrl =
          process.env.WATERMARK_WORKER_URL ||
          process.env.NEXT_PUBLIC_WATERMARK_WORKER_URL ||
          "https://repol-pdf-stamper.aidantroya24.workers.dev";

        // Si es descarga de PDF, redirigir al Worker pasándole la URL prefirmada
        if (isDownload && isPdf && watermarkWorkerUrl) {
          const workerRedirectUrl = `${watermarkWorkerUrl.replace(/\/+$/, "")}?url=${encodeURIComponent(presignedUrl)}&name=${encodeURIComponent(finalFilename)}`;
          return NextResponse.redirect(workerRedirectUrl, { status: 307 });
        }

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
