import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";
import { downloadDriveFileBuffer } from "@/lib/drive-utils";
import { downloadR2Buffer } from "@/lib/s3-r2";

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_").trim();
}

export async function GET(req: Request) {
  try {
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

    const zip = new JSZip();

    // Carpetas organizadas dentro del archivo comprimido
    const categoryFolders: Record<string, string> = {
      EXAMEN: "1. Exámenes",
      LECCION: "2. Lecciones",
      TALLER: "3. Talleres y Deberes",
      CLASE: "4. Clases y Apuntes",
    };

    let filesAddedCount = 0;

    // Procesar y descargar cada documento para incluirlo en el ZIP
    await Promise.all(
      subject.documents.map(async (doc, idx) => {
        const folderName = categoryFolders[doc.category] || "5. Otros";
        const folder = zip.folder(folderName);
        if (!folder) return;

        let fileBuffer: Buffer | null = null;

        // 1. Obtener buffer del archivo principal (Google Drive o Cloudflare R2)
        if (doc.storageKey.startsWith("gdrive:")) {
          const driveId = doc.storageKey.replace("gdrive:", "");
          fileBuffer = await downloadDriveFileBuffer(driveId);
        } else {
          fileBuffer = await downloadR2Buffer(doc.storageKey);
        }

        // Si falló la descarga directa por storageKey, intentar por URL
        if (!fileBuffer && doc.fileUrl.startsWith("http")) {
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
          const cleanSub = sanitizeFilename(doc.subcategory || "Doc");
          const cleanTitle = sanitizeFilename(doc.title);
          const ext = doc.mimeType.includes("pdf") ? ".pdf" : "";
          const fileName = `${doc.periodYear}_${doc.periodTerm}_${cleanSub}_${cleanTitle}${ext.length > 0 ? ext : ""}`;

          folder.file(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`, fileBuffer);
          filesAddedCount++;
        }

        // 2. Procesar anexos complementarios si existen
        if (doc.attachments && Array.isArray(doc.attachments) && doc.attachments.length > 0) {
          const attachmentsList = doc.attachments as Array<{ name: string; fileUrl: string; storageKey?: string }>;
          const cleanDocTitle = sanitizeFilename(doc.title).substring(0, 30);
          const attFolder = folder.folder(`Anexos_${doc.periodYear}_${doc.periodTerm}_${cleanDocTitle}_${idx + 1}`);

          if (attFolder) {
            for (const att of attachmentsList) {
              let attBuffer: Buffer | null = null;

              if (att.storageKey) {
                if (att.storageKey.startsWith("gdrive:")) {
                  attBuffer = await downloadDriveFileBuffer(att.storageKey.replace("gdrive:", ""));
                } else {
                  attBuffer = await downloadR2Buffer(att.storageKey);
                }
              }

              if (!attBuffer && att.fileUrl && att.fileUrl.startsWith("http")) {
                try {
                  const res = await fetch(att.fileUrl);
                  if (res.ok) {
                    const arrayBuf = await res.arrayBuffer();
                    attBuffer = Buffer.from(arrayBuf);
                  }
                } catch {
                  // Ignore attachment download failure
                }
              }

              if (attBuffer) {
                attFolder.file(sanitizeFilename(att.name), attBuffer);
              }
            }
          }
        }
      })
    );

    if (filesAddedCount === 0) {
      return NextResponse.json(
        { error: "No se pudieron obtener los archivos del almacenamiento." },
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

    const zipFilename = `${sanitizeFilename(subject.code)}_${sanitizeFilename(subject.name)}_RePol.zip`;

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
