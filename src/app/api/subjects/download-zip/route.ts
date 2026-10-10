import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPresignedDownloadUrl } from "@/lib/s3-r2";
import { 
  extractGoogleDriveFileId, 
  getDriveFileMetadata 
} from "@/lib/drive-utils";
import { 
  formatStandardDocumentFileName, 
  cleanDocumentTitle, 
  sanitizeFileNameWithExtension 
} from "@/lib/mime-utils";

function sanitizeFolderName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").trim();
}

function sanitizeBaseName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_").trim();
}

const CLOUDFLARE_DRIVE_PROXY =
  process.env.NEXT_PUBLIC_DRIVE_PROXY_URL ||
  "https://repol-drive-proxy.aidantroya24.workers.dev";

export const dynamic = "force-dynamic";

export interface ZipManifestFile {
  folderPath: string;
  filename: string;
  downloadUrl: string;
  source: "r2" | "gdrive";
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "Debes iniciar sesión con tu cuenta institucional @espol.edu.ec para descargar la materia completa en formato ZIP." },
        { status: 401 }
      );
    }

    const isStaff = session.user.role === "ADMIN" || session.user.role === "MODERATOR";

    if (!isStaff) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { approvedContributions: true },
      });
      const totalSubmissions = await prisma.submission.count({
        where: { userId: session.user.id },
      });
      const approvedSubmissions = await prisma.submission.count({
        where: { userId: session.user.id, status: "APPROVED" },
      });
      const effectiveContributions = Math.max(
        dbUser?.approvedContributions || 0,
        approvedSubmissions,
        totalSubmissions
      );

      if (effectiveContributions < 3) {
        return NextResponse.json(
          {
            error: `Para descargar la materia completa en formato ZIP debes haber completado al menos 3 subidas de material en RePol (actualmente tienes ${effectiveContributions}/3). Puedes descargar cada documento individualmente o contribuir subiendo exámenes o lecciones para desbloquear las descargas en ZIP.`,
            contributions: effectiveContributions,
            required: 3,
          },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get("subjectId");
    const subjectSlug = searchParams.get("slug");
    const subjectCode = searchParams.get("code");

    if (!subjectId && !subjectSlug && !subjectCode) {
      return NextResponse.json(
        { error: "Se requiere subjectId, slug o code de la materia." },
        { status: 400 }
      );
    }

    const subject = await prisma.subject.findFirst({
      where: {
        OR: [
          subjectId ? { id: subjectId } : {},
          subjectSlug ? { slug: subjectSlug } : {},
          subjectCode ? { code: subjectCode } : {},
        ],
      },
      include: {
        documents: {
          orderBy: [
            { category: "asc" },
            { subcategory: "asc" },
            { periodYear: "desc" },
            { periodTerm: "asc" },
          ],
        },
      },
    });

    if (!subject) {
      return NextResponse.json(
        { error: "Materia no encontrada en el catálogo de la ESPOL." },
        { status: 404 }
      );
    }

    if (subject.documents.length === 0) {
      return NextResponse.json(
        { error: `No hay documentos disponibles para descargar en ${subject.name} (${subject.code}).` },
        { status: 404 }
      );
    }

    const categoryFolders: Record<string, string> = {
      EXAMEN: "Exámenes",
      LECCION: "Lecciones",
      TALLER: "Talleres",
      TAREA: "Material de Entrenamiento",
      CLASE: "Clases y Apuntes",
    };

    // Incrementar estadísticas de descarga en segundo plano
    prisma.document.updateMany({
      where: {
        id: { in: subject.documents.map((d) => d.id) },
      },
      data: {
        downloadCount: { increment: 1 },
      },
    }).catch((e) => console.warn("Error incrementando stats:", e));

    const filesToDownload: ZipManifestFile[] = [];

    // Generar enlaces directos (R2 presigned download URL o Google Drive direct export)
    // CERO BYTES de Vercel Origin Transfer
    await Promise.all(
      subject.documents.map(async (doc, idx) => {
        const mainCategory = categoryFolders[doc.category] || "Otros";
        const subcategoryFolder = sanitizeFolderName(doc.subcategory || "General");
        const folderPath = `${mainCategory}/${subcategoryFolder}`;

        const isGoogleDrive =
          doc.storageKey.startsWith("gdrive:") ||
          doc.fileUrl.includes("drive.google.com");

        const finalDocName = formatStandardDocumentFileName({
          title: doc.title,
          year: doc.periodYear,
          term: doc.periodTerm,
          subjectCode: subject.code,
          mimeType: doc.mimeType,
        });

        if (isGoogleDrive) {
          const driveId =
            doc.storageKey.replace(/^gdrive:/, "") ||
            extractGoogleDriveFileId(doc.fileUrl);

          if (driveId) {
            // Descarga a través de Cloudflare Worker con cabeceras CORS
            // 0 BYTES consumidos en Vercel, y el navegador puede leer el binario para meterlo al ZIP
            const workerProxyUrl = `${CLOUDFLARE_DRIVE_PROXY.replace(/\/$/, "")}?id=${encodeURIComponent(driveId)}`;
            filesToDownload.push({
              folderPath,
              filename: finalDocName,
              downloadUrl: workerProxyUrl,
              source: "gdrive",
            });
          }
        } else if (doc.storageKey) {
          try {
            const presignedUrl = await getPresignedDownloadUrl(doc.storageKey, 3600, {
              responseContentDisposition: `attachment; filename="${encodeURIComponent(finalDocName)}"`,
              responseContentType: doc.mimeType || "application/pdf",
            });
            filesToDownload.push({
              folderPath,
              filename: finalDocName,
              downloadUrl: presignedUrl,
              source: "r2",
            });
          } catch (e) {
            console.warn(`Error generating presigned url for doc ${doc.id}:`, e);
          }
        }

        // Anexos
        if (doc.attachments && Array.isArray(doc.attachments) && doc.attachments.length > 0) {
          const attachmentsList = doc.attachments as Array<{
            name: string;
            fileUrl: string;
            storageKey?: string;
            mimeType?: string;
            fileSize?: number;
          }>;
          const cleanDocTitle = cleanDocumentTitle(doc.title, doc.periodYear, doc.periodTerm).substring(0, 30);
          const yearLabel = doc.periodYear && doc.periodYear > 0 ? doc.periodYear : "SF";
          const attFolderPath = `${folderPath}/Anexos_${yearLabel}_${doc.periodTerm}_${cleanDocTitle}_${subject.code}_${idx + 1}`;

          for (const att of attachmentsList) {
            const attIsDrive =
              att.storageKey?.startsWith("gdrive:") ||
              (att.fileUrl && att.fileUrl.includes("drive.google.com"));

            if (attIsDrive) {
              const attDriveId =
                att.storageKey?.replace(/^gdrive:/, "") ||
                extractGoogleDriveFileId(att.fileUrl);

              if (attDriveId) {
                const driveMeta = await getDriveFileMetadata(attDriveId);
                const baseName = att.name || driveMeta?.name || "Anexo";
                const attFinalName = sanitizeFileNameWithExtension(baseName, driveMeta?.mimeType || att.mimeType);
                const workerProxyUrl = `${CLOUDFLARE_DRIVE_PROXY.replace(/\/$/, "")}?id=${encodeURIComponent(attDriveId)}`;
                filesToDownload.push({
                  folderPath: attFolderPath,
                  filename: attFinalName,
                  downloadUrl: workerProxyUrl,
                  source: "gdrive",
                });
              }
            } else if (att.storageKey) {
              try {
                const attFinalName = sanitizeFileNameWithExtension(att.name, att.mimeType);
                const attDownloadUrl = await getPresignedDownloadUrl(att.storageKey, 3600, {
                  responseContentDisposition: `attachment; filename="${encodeURIComponent(attFinalName)}"`,
                  responseContentType: att.mimeType || "application/octet-stream",
                });
                filesToDownload.push({
                  folderPath: attFolderPath,
                  filename: attFinalName,
                  downloadUrl: attDownloadUrl,
                  source: "r2",
                });
              } catch (e) {
                console.warn(`Error generating presigned url for attachment:`, e);
              }
            }
          }
        }
      })
    );

    const zipFilename = `${sanitizeBaseName(subject.code)}_${sanitizeBaseName(subject.name)}_RePol.zip`;

    return NextResponse.json({
      success: true,
      subjectCode: subject.code,
      subjectName: subject.name,
      zipFilename,
      totalFiles: filesToDownload.length,
      files: filesToDownload,
    });
  } catch (error) {
    console.error("Error al obtener manifiesto para ZIP de la materia:", error);
    return NextResponse.json(
      { error: "Ocurrió un error al procesar el material de la materia." },
      { status: 500 }
    );
  }
}
