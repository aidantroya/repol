import { NextResponse } from "next/server";
import { 
  extractGoogleDriveFileId, 
  extractGoogleDriveFolderId,
  fetchGoogleDriveFolderFiles,
  computeDriveFileHash, 
  getGoogleDrivePreviewUrl, 
  getGoogleDriveDownloadUrl 
} from "@/lib/drive-utils";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { driveUrl } = await req.json();

    if (!driveUrl) {
      return NextResponse.json({ error: "El enlace de Google Drive es obligatorio" }, { status: 400 });
    }

    const folderId = extractGoogleDriveFolderId(driveUrl);

    // CASO 1: Es un enlace a una CARPETA de Google Drive
    if (folderId) {
      const debugLogs: string[] = [];
      const folderFiles = await fetchGoogleDriveFolderFiles(
        folderId,
        "",
        0,
        4,
        new Set<string>(),
        debugLogs
      );

      if (folderFiles.length === 0) {
        const hasApiKey = Boolean(process.env.GOOGLE_DRIVE_API_KEY);
        const errorMsg = hasApiKey
          ? "No se encontraron archivos en la carpeta de Google Drive. Asegúrate de que la carpeta o sus subcarpetas contengan documentos y que esté en modo público ('Cualquier persona con el enlace')."
          : "No se pudieron extraer los archivos automáticamente. Para explorar carpetas y subcarpetas con la API oficial v3 de Google Drive, agrega la variable GOOGLE_DRIVE_API_KEY en tu archivo .env o en el panel de Vercel. También puedes subir los archivos PDF/DOCX directamente o usar sus enlaces individuales.";

        return NextResponse.json(
          {
            error: errorMsg,
            debugLogs,
          },
          { status: 404 }
        );
      }

      // Procesar cada archivo dentro de la carpeta
      const processedItems = await Promise.all(
        folderFiles.map(async (file) => {
          const { fileHash, fileSize, mimeType } = await computeDriveFileHash(file.id, file.name);

          // Verificar si ya existe en la base de datos
          const existingDoc = await prisma.document.findFirst({
            where: {
              OR: [
                { fileHash },
                { storageKey: `gdrive:${file.id}` },
              ],
            },
          });

          const existingSub = await prisma.submission.findFirst({
            where: {
              OR: [
                { fileHash },
                { storageKey: `gdrive:${file.id}` },
              ],
              status: "PENDING",
            },
          });

          const isDuplicate = Boolean(existingDoc || existingSub);

          return {
            fileId: file.id,
            name: file.name.replace(/\.[^/.]+$/, "") || "Documento Drive",
            fileHash,
            fileSize: file.fileSize || fileSize,
            mimeType: file.mimeType || mimeType,
            storageKey: `gdrive:${file.id}`,
            fileUrl: getGoogleDrivePreviewUrl(file.id),
            downloadUrl: getGoogleDriveDownloadUrl(file.id),
            folderPath: file.folderPath,
            exists: isDuplicate,
            duplicateMessage: existingDoc
              ? "Este archivo ya existe en el repositorio."
              : existingSub
              ? "Este archivo ya se encuentra en revisión."
              : undefined,
          };
        })
      );

      return NextResponse.json({
        isFolder: true,
        folderId,
        totalFound: folderFiles.length,
        items: processedItems,
      });
    }

    // CASO 2: Es un enlace a un ARCHIVO INDIVIDUAL de Google Drive
    const fileId = extractGoogleDriveFileId(driveUrl);
    if (!fileId) {
      return NextResponse.json(
        {
          error: "El formato del enlace no es válido. Asegúrate de que sea un enlace válido a un archivo o carpeta de Google Drive.",
        },
        { status: 400 }
      );
    }

    // Calcular el Hash SHA-256 del documento de Drive
    const { fileHash, fileSize, mimeType } = await computeDriveFileHash(fileId);

    // 1. Verificar si ya existe en documentos públicos
    const existingDoc = await prisma.document.findFirst({
      where: {
        OR: [
          { fileHash },
          { storageKey: `gdrive:${fileId}` },
        ],
      },
      include: {
        subject: {
          include: {
            careers: {
              include: { career: true },
            },
          },
        },
      },
    });

    if (existingDoc) {
      const careerNames = existingDoc.subject.careers.map((c) => c.career.name).join(", ");
      return NextResponse.json({
        isFolder: false,
        exists: true,
        type: "APPROVED_DOCUMENT",
        message: `Este documento ya está disponible en el repositorio bajo "${existingDoc.subject.name} (${existingDoc.subject.code}) - ${existingDoc.category} (${existingDoc.subcategory})".`,
        document: {
          title: existingDoc.title,
          career: careerNames,
          subject: existingDoc.subject.name,
        },
      });
    }

    // 2. Verificar si está en la cola de revisión
    const existingSubmission = await prisma.submission.findFirst({
      where: {
        OR: [
          { fileHash },
          { storageKey: `gdrive:${fileId}` },
        ],
        status: "PENDING",
      },
    });

    if (existingSubmission) {
      return NextResponse.json({
        isFolder: false,
        exists: true,
        type: "PENDING_SUBMISSION",
        message: "Este archivo de Google Drive ya fue enviado por otro estudiante y se encuentra en revisión.",
      });
    }

    const previewUrl = getGoogleDrivePreviewUrl(fileId);
    const downloadUrl = getGoogleDriveDownloadUrl(fileId);

    return NextResponse.json({
      isFolder: false,
      exists: false,
      fileId,
      name: "Documento Google Drive",
      fileHash,
      fileSize,
      mimeType,
      storageKey: `gdrive:${fileId}`,
      fileUrl: previewUrl,
      downloadUrl,
    });
  } catch (error: unknown) {
    console.error("Error processing Google Drive link:", error);
    const msg = error instanceof Error ? error.message : "Error al procesar el enlace de Google Drive";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
