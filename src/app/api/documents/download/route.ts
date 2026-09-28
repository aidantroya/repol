import { NextResponse } from "next/server";
import { s3Client } from "@/lib/s3-r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getPresignedDownloadUrl } from "@/lib/s3-r2";
import { prisma } from "@/lib/prisma";
import { Readable } from "stream";

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "repol-academic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const documentId = searchParams.get("id");
    const mode = searchParams.get("mode") || "stream"; // 'stream' o 'redirect'

    let targetKey = key;

    // Si pasaron documentId en vez de key, buscar la storageKey en la BD
    if (!targetKey && documentId) {
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { storageKey: true, fileUrl: true },
      });

      if (doc?.storageKey) {
        targetKey = doc.storageKey;
      }
    }

    if (!targetKey) {
      return NextResponse.json({ error: "Falta el parámetro 'key' o 'id' del documento" }, { status: 400 });
    }

    // Modo 1: Redirección mediante URL prefirmada de R2 (válida por 1 hora)
    if (mode === "redirect") {
      try {
        const presignedUrl = await getPresignedDownloadUrl(targetKey, 3600);
        return NextResponse.redirect(presignedUrl);
      } catch (err) {
        console.warn("No se pudo generar presigned download URL, procediendo con streaming directo:", err);
      }
    }

    // Modo 2 (Por defecto): Streaming directo con headers adecuados para visor PDF
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: targetKey,
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

    const contentType = s3Response.ContentType || "application/pdf";
    const filename = targetKey.split("/").pop() || "documento.pdf";

    return new Response(webStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
        ...(s3Response.ContentLength && {
          "Content-Length": s3Response.ContentLength.toString(),
        }),
      },
    });
  } catch (error: unknown) {
    console.error("Error al obtener documento desde R2:", error);
    const err = error as { name?: string; message?: string };
    if (err.name === "NoSuchKey" || err.message?.includes("NoSuchKey")) {
      return NextResponse.json({ error: "Documento no encontrado en Cloudflare R2." }, { status: 404 });
    }
    return NextResponse.json({ error: "Error al recuperar el archivo del servidor." }, { status: 500 });
  }
}
