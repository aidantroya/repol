import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DocumentCategory } from "@prisma/client";
import { formatVersionedTitle, extractVersionFromTitle } from "@/lib/metadata-detector";

// Obtener envíos del usuario autenticado y estadísticas en tiempo real
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const [submissions, dbUser, realApprovedCount] = await Promise.all([
      prisma.submission.findMany({
        where: { userId: session.user.id },
        include: {
          subject: {
            include: {
              careers: {
                include: { career: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { approvedContributions: true, role: true },
      }),
      prisma.document.count({
        where: { uploadedById: session.user.id },
      }),
    ]);

    const approvedContributions = Math.max(dbUser?.approvedContributions || 0, realApprovedCount);

    if (dbUser && dbUser.approvedContributions !== approvedContributions) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { approvedContributions },
      });
    }

    return NextResponse.json({
      submissions,
      approvedContributions,
      role: dbUser?.role || "STUDENT",
    });
  } catch (error) {
    console.error("Error fetching user submissions:", error);
    return NextResponse.json({ error: "Error al obtener solicitudes" }, { status: 500 });
  }
}

// Crear una nueva solicitud de subida
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado. Inicia sesión para proponer documentos." }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      description,
      fileHash,
      fileSize,
      mimeType,
      storageKey,
      fileUrl,
      category,
      subcategory,
      customDescription,
      periodYear,
      periodTerm,
      subjectId,
      attachments,
    } = body;

    if (!title || !fileHash || !subjectId || !category || !subcategory) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // Normalizar año (0 = S/F Sin fecha / No especificado)
    const rawYearStr = String(periodYear ?? "").trim().toUpperCase();
    const parsedYear = (rawYearStr === "S/F" || rawYearStr === "0" || rawYearStr === "SF" || rawYearStr === "N/D" || rawYearStr === "N/A" || rawYearStr === "SIN FECHA")
      ? 0
      : (isNaN(parseInt(rawYearStr, 10)) || parseInt(rawYearStr, 10) <= 0 ? 0 : parseInt(rawYearStr, 10));

    // Normalizar término (1PAO, 2PAO, PAE)
    let cleanTerm = (periodTerm || "1PAO").toUpperCase().trim();
    if (cleanTerm === "1T" || cleanTerm === "1-PAO" || cleanTerm === "1") cleanTerm = "1PAO";
    else if (cleanTerm === "2T" || cleanTerm === "2-PAO" || cleanTerm === "2") cleanTerm = "2PAO";
    else if (cleanTerm === "3T" || cleanTerm === "3PAO" || cleanTerm === "INTENSIVO") cleanTerm = "PAE";

    // 1. Verificación por contenido idéntico (mismo hash SHA-256)
    const existingDocByHash = await prisma.document.findFirst({
      where: { fileHash },
      include: { subject: true },
    });

    if (existingDocByHash) {
      return NextResponse.json(
        { error: `Este documento ya está publicado en el repositorio oficial ("${existingDocByHash.title}").` },
        { status: 409 }
      );
    }

    const existingSubByHash = await prisma.submission.findFirst({
      where: {
        fileHash,
        status: "PENDING",
      },
      include: { subject: true },
    });

    if (existingSubByHash) {
      return NextResponse.json(
        { error: `Ya existe una solicitud pendiente de revisión para este mismo archivo ("${existingSubByHash.title}").` },
        { status: 409 }
      );
    }

    // 2. Verificación para EXÁMENES (los exámenes son estrictamente únicos por materia, tipo, año y periodo)
    if (category === "EXAMEN") {
      const existingExamDoc = await prisma.document.findFirst({
        where: {
          subjectId,
          category: "EXAMEN",
          subcategory,
          periodYear: parsedYear,
          periodTerm: cleanTerm,
        },
      });

      if (existingExamDoc) {
        return NextResponse.json(
          { error: `Ya existe un examen oficial publicado para este período ("${existingExamDoc.title}").` },
          { status: 409 }
        );
      }

      const existingExamSub = await prisma.submission.findFirst({
        where: {
          subjectId,
          category: "EXAMEN",
          subcategory,
          periodYear: parsedYear,
          periodTerm: cleanTerm,
          status: "PENDING",
        },
      });

      if (existingExamSub) {
        return NextResponse.json(
          { error: `Ya existe una solicitud pendiente de revisión para este examen ("${existingExamSub.title}").` },
          { status: 409 }
        );
      }
    }

    // 3. Para actividades que NO son exámenes (Lecciones, Talleres, etc.), asignar versión v2, v3 si ya existen documentos previos del mismo periodo
    let finalTitle = String(title).trim();

    if (category !== "EXAMEN") {
      const existingMatchingDocs = await prisma.document.findMany({
        where: {
          subjectId,
          category: category as DocumentCategory,
          subcategory,
          periodYear: parsedYear,
          periodTerm: cleanTerm,
        },
        select: { title: true },
      });

      const existingMatchingSubs = await prisma.submission.findMany({
        where: {
          subjectId,
          category: category as DocumentCategory,
          subcategory,
          periodYear: parsedYear,
          periodTerm: cleanTerm,
          status: "PENDING",
        },
        select: { title: true },
      });

      const allMatchingTitles = [
        ...existingMatchingDocs.map((d) => d.title),
        ...existingMatchingSubs.map((s) => s.title),
      ];

      if (allMatchingTitles.length > 0) {
        // Verificar si el título actual ya tiene una versión especificada explícitamente por el usuario
        const currentTitleVersion = extractVersionFromTitle(finalTitle);
        const versions = allMatchingTitles.map((t) => extractVersionFromTitle(t));
        const maxExistingVersion = Math.max(1, ...versions);

        if (currentTitleVersion <= 1) {
          const nextVersion = maxExistingVersion + 1;
          finalTitle = formatVersionedTitle(finalTitle, nextVersion);
        }
      }
    }

    const submission = await prisma.submission.create({
      data: {
        title: finalTitle,
        description: description || null,
        fileHash,
        fileSize: fileSize || 0,
        mimeType: mimeType || "application/pdf",
        storageKey: storageKey || `doc-${Date.now()}`,
        fileUrl: fileUrl || "#",
        attachments: attachments || null,
        category,
        subcategory,
        customDescription: customDescription || null,
        periodYear: parsedYear,
        periodTerm: cleanTerm,
        subjectId,
        userId: session.user.id,
        status: "PENDING",
      },
      include: {
        subject: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Documento enviado correctamente a la cola de moderación.",
      submission,
    });
  } catch (error) {
    console.error("Error creating submission:", error);
    return NextResponse.json({ error: "Error al registrar la solicitud" }, { status: 500 });
  }
}
