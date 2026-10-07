import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";
import { 
  downloadDriveFileBuffer, 
  extractGoogleDriveFileId, 
  getDriveFileMetadata 
} from "@/lib/drive-utils";
import { downloadR2Buffer } from "@/lib/s3-r2";
import { 
  sanitizeFileNameWithExtension, 
  formatStandardDocumentFileName, 
  cleanDocumentTitle 
} from "@/lib/mime-utils";

function sanitizeFolderName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").trim();
}

function sanitizeBaseName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_").trim();
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

    // Buscar materia y todos sus documentos aprobados
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

    const termWeights: Record<string, number> = {
      "2PAO": 3, "2T": 3,
      "1PAO": 2, "1T": 2,
      "PAE": 1, "3PAO": 1, "3T": 1, "Intensivo": 1,
    };

    subject.documents.sort((a, b) => {
      const yearA = a.periodYear || 0;
      const yearB = b.periodYear || 0;
      if (yearA === 0 && yearB !== 0) return 1;
      if (yearB === 0 && yearA !== 0) return -1;
      if (yearB !== yearA) return yearB - yearA;
      const termA = termWeights[a.periodTerm] ?? 0;
      const termB = termWeights[b.periodTerm] ?? 0;
      return termB - termA;
    });

    const zip = new JSZip();

    // Carpetas principales organizadas dentro del archivo ZIP
    const categoryFolders: Record<string, string> = {
      EXAMEN: "Exámenes",
      LECCION: "Lecciones",
      TALLER: "Talleres",
      TAREA: "Material de Entrenamiento",
      CLASE: "Clases y Apuntes",
    };

    let filesAddedCount = 0;

    // Procesar y descargar cada documento para clasificarlo en su subcarpeta correspondiente
    await Promise.all(
      subject.documents.map(async (doc, idx) => {
        const mainCategory = categoryFolders[doc.category] || "Otros";
        const subcategoryFolder = sanitizeFolderName(doc.subcategory || "General");
        
        // Estructura: Exámenes/Parcial, Lecciones/Lección 1, Talleres/Taller 2, etc.
        const targetFolder = zip.folder(`${mainCategory}/${subcategoryFolder}`);
        if (!targetFolder) return;

        let fileBuffer: Buffer | null = null;

        // 1. Obtener buffer del archivo principal (Google Drive o Cloudflare R2)
        const driveIdFromStorage = doc.storageKey.startsWith("gdrive:") 
          ? doc.storageKey.replace("gdrive:", "") 
          : null;
        const driveIdFromUrl = !driveIdFromStorage && doc.fileUrl.includes("drive.google.com") 
          ? extractGoogleDriveFileId(doc.fileUrl) 
          : null;
        const effectiveDriveId = driveIdFromStorage || driveIdFromUrl;

        if (effectiveDriveId) {
          fileBuffer = await downloadDriveFileBuffer(effectiveDriveId);
        } else {
          fileBuffer = await downloadR2Buffer(doc.storageKey);
        }

        // Si falló la descarga directa por storageKey, intentar por URL
        if (!fileBuffer && doc.fileUrl.startsWith("http") && !effectiveDriveId) {
          try {
            const res = await fetch(doc.fileUrl);
            if (res.ok) {
              const arrayBuf = await res.arrayBuffer();
              fileBuffer = Buffer.from(arrayBuf);
            }
          } catch (e) {
            console.warn(`No se pudo obtener archivo por URL para doc ${doc.id}:`, e);
          }
        }

        if (fileBuffer) {
          const finalFileName = formatStandardDocumentFileName({
            title: doc.title,
            year: doc.periodYear,
            term: doc.periodTerm,
            subjectCode: subject.code,
            mimeType: doc.mimeType,
            buffer: fileBuffer,
          });

          targetFolder.file(finalFileName, fileBuffer);
          filesAddedCount++;
        }

        // 2. Procesar anexos complementarios dentro de su subcarpeta correspondiente
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
          const attFolder = targetFolder.folder(`Anexos_${yearLabel}_${doc.periodTerm}_${cleanDocTitle}_${subject.code}_${idx + 1}`);

          if (attFolder) {
            for (const att of attachmentsList) {
              let attBuffer: Buffer | null = null;
              let attDriveMeta: { id: string; name?: string; mimeType?: string } | null = null;

              // Identificar si el anexo proviene de Google Drive
              const attDriveId = att.storageKey?.startsWith("gdrive:")
                ? att.storageKey.replace("gdrive:", "")
                : att.fileUrl && att.fileUrl.includes("drive.google.com")
                ? extractGoogleDriveFileId(att.fileUrl)
                : null;

              if (attDriveId) {
                attDriveMeta = await getDriveFileMetadata(attDriveId);
                attBuffer = await downloadDriveFileBuffer(attDriveId);
              } else if (att.storageKey) {
                attBuffer = await downloadR2Buffer(att.storageKey);
              }

              // Fallback por URL HTTP si no se obtuvo buffer
              if (!attBuffer && att.fileUrl && att.fileUrl.startsWith("http") && !attDriveId) {
                try {
                  const res = await fetch(att.fileUrl);
                  if (res.ok) {
                    const arrayBuf = await res.arrayBuffer();
                    attBuffer = Buffer.from(arrayBuf);
                  }
                } catch {
                  // Ignore attachment failure
                }
              }

              if (attBuffer) {
                // Determinar el nombre con extensión apropiada
                let baseAttName = att.name || attDriveMeta?.name || "Anexo";
                
                // Si el nombre no tiene extensión pero tenemos el nombre original de Drive, usar la extensión de Drive
                if (!baseAttName.includes(".") && attDriveMeta?.name?.includes(".")) {
                  const origExtMatch = attDriveMeta.name.match(/\.([a-zA-Z0-9]{2,5})$/);
                  if (origExtMatch) {
                    baseAttName = `${baseAttName}.${origExtMatch[1]}`;
                  }
                }

                const finalAttName = sanitizeFileNameWithExtension(
                  baseAttName,
                  attDriveMeta?.mimeType || att.mimeType,
                  attBuffer
                );

                attFolder.file(finalAttName, attBuffer);
              }
            }
          }
        }
      })
    );

    if (filesAddedCount === 0) {
      return NextResponse.json(
        { error: "No se pudieron obtener los archivos del almacenamiento para el ZIP." },
        { status: 500 }
      );
    }

    // Generar archivo ZIP binario
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    // Incrementar estadísticas de descarga
    await prisma.document.updateMany({
      where: {
        id: { in: subject.documents.map((d) => d.id) },
      },
      data: {
        downloadCount: { increment: 1 },
      },
    });

    const zipFilename = `${sanitizeBaseName(subject.code)}_${sanitizeBaseName(subject.name)}_RePol.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error al generar ZIP de la materia:", error);
    return NextResponse.json(
      { error: "Ocurrió un error al empaquetar el material de la materia." },
      { status: 500 }
    );
  }
}
