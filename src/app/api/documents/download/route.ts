import { NextResponse } from "next/server";
import { s3Client } from "@/lib/s3-r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getPresignedDownloadUrl } from "@/lib/s3-r2";
import { prisma } from "@/lib/prisma";
import { extractGoogleDriveFileId } from "@/lib/drive-utils";
import { Readable } from "stream";

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "repol-academic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const documentId = searchParams.get("id");
    const mode = searchParams.get("mode"); // 'stream', 'redirect', 'download', 'inline'
    const isDownload = searchParams.get("download") === "true" || mode === "download";

    let targetKey = key;
    let docTitle = "";
    let docFileUrl = "";
    let docMimeType = "application/pdf";

    // Si pasaron documentId o key, buscar en la BD
    if (documentId) {
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { id: true, title: true, storageKey: true, fileUrl: true, mimeType: true },
      });

      if (doc) {
        targetKey = doc.storageKey;
        docTitle = doc.title;
        docFileUrl = doc.fileUrl;
        docMimeType = doc.mimeType || "application/pdf";

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
        select: { id: true, title: true, storageKey: true, fileUrl: true, mimeType: true },
      });

      if (doc) {
        docTitle = doc.title;
        docFileUrl = doc.fileUrl;
        docMimeType = doc.mimeType || "application/pdf";

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
      return NextResponse.json({ error: "Falta el parámetro 'key' o 'id' del documento" }, { status: 400 });
    }

    // Preparar el nombre del archivo para la cabecera Content-Disposition
    const safeTitle = (docTitle || targetKey || "documento")
      .replace(/[^a-zA-Z0-9\s._-]/g, "_")
      .replace(/\s+/g, "_")
      .trim();
    const finalFilename = safeTitle.toLowerCase().endsWith(".pdf") ? safeTitle : `${safeTitle}.pdf`;
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

      const driveDownloadUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}`;
      const driveRes = await fetch(driveDownloadUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RePol-Academic-Agent",
        },
      });

      if (!driveRes.ok) {
        console.error("Error al descargar desde Google Drive, status:", driveRes.status);
        return NextResponse.json(
          { error: "No se pudo recuperar el archivo desde Google Drive. Verifica que el enlace sea público." },
          { status: 502 }
        );
      }

      // Si Google Drive responde con confirmación o streaming directo:
      const arrayBuffer = await driveRes.arrayBuffer();
      const contentType = driveRes.headers.get("content-type") || docMimeType;

      return new Response(arrayBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `${dispositionType}; filename="${encodeURIComponent(finalFilename)}"`,
          "Content-Length": arrayBuffer.byteLength.toString(),
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
        },
      });
    }

    // =========================================================================
    // CASO 2: Documento almacenado en CLOUDFLARE R2
    // =========================================================================
    if (mode === "redirect") {
      try {
        const presignedUrl = await getPresignedDownloadUrl(targetKey!, 3600);
        return NextResponse.redirect(presignedUrl);
      } catch (err) {
        console.warn("No se pudo generar presigned download URL, procediendo con streaming directo:", err);
      }
    }

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: targetKey!,
    });

    const s3Response = await s3Client.send(command);

    if (!s3Response.Body) {
      return NextResponse.json({ error: "El archivo no existe en el almacenamiento" }, { status: 404 });
    }

    const nodeStream = s3Response.Body as Readable;
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk: Buffer | Uint8Array) => controller.enqueue(chunk));
        nodeStream.on("end", () => controller.close());
        nodeStream.on("error", (err: Error) => controller.error(err));
      },
    });

    const contentType = s3Response.ContentType || docMimeType || "application/pdf";

    return new Response(webStream, {
      headers: {
        "Content-Type": contentType,
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
