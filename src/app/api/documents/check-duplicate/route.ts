import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { fileHash, subjectId, category, subcategory } = await req.json();

    if (!fileHash) {
      return NextResponse.json({ error: "El hash SHA-256 es requerido" }, { status: 400 });
    }

    // 1. Verificar si ya existe en documentos publicados
    const existingDoc = await prisma.document.findUnique({
      where: { fileHash },
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
      const careerNames = existingDoc.subject.careers.map((c) => c.career.name).join(", ") || "ESPOL";
      return NextResponse.json({
        exists: true,
        type: "APPROVED_DOCUMENT",
        message: `Este documento ya existe en el repositorio bajo "${existingDoc.subject.name} (${existingDoc.subject.code}) - ${existingDoc.category} (${existingDoc.subcategory})".`,
        document: {
          id: existingDoc.id,
          title: existingDoc.title,
          career: careerNames,
          subject: `${existingDoc.subject.name} (${existingDoc.subject.code})`,
          category: existingDoc.category,
          subcategory: existingDoc.subcategory,
        },
      });
    }

    // 2. Verificar si está en la cola de revisión pendiente
    const existingSubmission = await prisma.submission.findFirst({
      where: {
        fileHash,
        status: "PENDING",
      },
      include: {
        subject: true,
      },
    });

    if (existingSubmission) {
      return NextResponse.json({
        exists: true,
        type: "PENDING_SUBMISSION",
        message: `Este documento ya fue enviado por otro estudiante y se encuentra en revisión.`,
      });
    }

    // 3. Advertencia suave si existe un documento similar por metadatos
    let similarDoc = null;
    if (subjectId && category && subcategory) {
      similarDoc = await prisma.document.findFirst({
        where: {
          subjectId,
          category,
          subcategory,
        },
        select: {
          title: true,
          periodYear: true,
          periodTerm: true,
        },
      });
    }

    return NextResponse.json({
      exists: false,
      similar: similarDoc
        ? {
            title: similarDoc.title,
            period: `${similarDoc.periodYear} - ${similarDoc.periodTerm}`,
          }
        : null,
    });
  } catch (error) {
    console.error("Error checking duplicate:", error);
    return NextResponse.json({ error: "Error al verificar duplicados" }, { status: 500 });
  }
}
