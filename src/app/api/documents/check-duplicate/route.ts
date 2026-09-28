import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeSemanticContentHash } from "@/lib/content-hash";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let fileHash = "";
    let semanticHash = "";
    let subjectId = "";
    let category = "";
    let subcategory = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      subjectId = (formData.get("subjectId") as string) || "";
      category = (formData.get("category") as string) || "";
      subcategory = (formData.get("subcategory") as string) || "";

      if (!file) {
        return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
      }

      const arrayBuf = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      const fp = await computeSemanticContentHash(buffer, file.name, file.type);
      fileHash = fp.contentHash;
      semanticHash = fp.contentHash;
    } else {
      const body = await req.json();
      fileHash = body.fileHash;
      semanticHash = body.semanticHash || body.fileHash;
      subjectId = body.subjectId;
      category = body.category;
      subcategory = body.subcategory;
    }

    if (!fileHash) {
      return NextResponse.json({ error: "El hash SHA-256 es requerido" }, { status: 400 });
    }

    const hashesToCheck = Array.from(new Set([fileHash, semanticHash].filter(Boolean)));

    // 1. Verificar si ya existe en documentos publicados (por cualquiera de sus huellas)
    const existingDoc = await prisma.document.findFirst({
      where: {
        OR: hashesToCheck.map((h) => ({ fileHash: h })),
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
      const careerNames = existingDoc.subject.careers.map((c) => c.career.name).join(", ") || "ESPOL";
      return NextResponse.json({
        exists: true,
        type: "APPROVED_DOCUMENT",
        fileHash,
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
        OR: hashesToCheck.map((h) => ({ fileHash: h })),
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
        fileHash,
        message: `Este documento ya fue enviado por otro estudiante y se encuentra en revisión.`,
      });
    }

    // 3. Advertencia suave si existe un documento similar por metadatos
    let similarDoc = null;
    if (subjectId && category && subcategory) {
      similarDoc = await prisma.document.findFirst({
        where: {
          subjectId,
          category: category as "CLASE" | "LECCION" | "TALLER" | "EXAMEN",
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
      fileHash,
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
