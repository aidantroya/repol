import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPresignedUploadUrl } from "@/lib/s3-r2";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado. Inicia sesión primero." }, { status: 401 });
    }

    const { filename, contentType, careerSlug, subjectSlug, category, fileSize } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: "Faltan datos del archivo" }, { status: 400 });
    }

    // 🔒 PROTECCIÓN ANTICOBROS: Límite estricto de 9.8 GB (10 GB Free Tier de Cloudflare)
    const MAX_STORAGE_BYTES = 9.8 * 1024 * 1024 * 1024; // 9.8 GB
    const storageStats = await prisma.document.aggregate({
      _sum: { fileSize: true },
    });

    const currentTotalBytes = storageStats._sum.fileSize || 0;
    const incomingFileBytes = fileSize || 0;

    if (currentTotalBytes + incomingFileBytes > MAX_STORAGE_BYTES) {
      return NextResponse.json(
        {
          error: "Capacidad máxima de almacenamiento gratuito alcanzada (10 GB). No se admiten nuevas subidas temporales.",
        },
        { status: 507 } // 507 Insufficient Storage
      );
    }

    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `uploads/${careerSlug || "general"}/${subjectSlug || "misc"}/${category || "docs"}/${timestamp}-${sanitizedFilename}`;

    // Si Cloudflare R2 está configurado con credenciales
    if (process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_ACCOUNT_ID) {
      const presigned = await getPresignedUploadUrl(key, contentType);
      return NextResponse.json(presigned);
    }

    // Modo local / Mock cuando aún no se han colocado las credenciales de R2
    return NextResponse.json({
      uploadUrl: "/api/upload/mock-direct",
      key,
      publicUrl: `/mock-storage/${key}`,
      isMock: true,
    });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json({ error: "Error al generar enlace de subida" }, { status: 500 });
  }
}
