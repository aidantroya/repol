import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeSemanticContentHash } from "@/lib/content-hash";
import { detectDocumentMetadata } from "@/lib/metadata-detector";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let fileHash = "";
    let semanticHash = "";
    let subjectId = "";
    let category = "";
    let subcategory = "";
    let filename = "";
    let rawExtractedText = "";

    // Cargar catálogo de materias para detección
    const allSubjects = await prisma.subject.findMany({
      select: { id: true, name: true, code: true },
    });

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      subjectId = (formData.get("subjectId") as string) || "";
      category = (formData.get("category") as string) || "";
      subcategory = (formData.get("subcategory") as string) || "";

      if (!file) {
        return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
      }

      filename = file.name;
      const arrayBuf = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      const fp = await computeSemanticContentHash(buffer, file.name, file.type);
      fileHash = fp.contentHash;
      semanticHash = fp.contentHash;
      rawExtractedText = fp.rawText || "";
    } else {
      const body = await req.json();
      fileHash = body.fileHash;
      semanticHash = body.semanticHash || body.fileHash;
      subjectId = body.subjectId;
      category = body.category;
      subcategory = body.subcategory;
      filename = body.filename || "";
      rawExtractedText = body.rawText || "";
    }

    if (!fileHash) {
      return NextResponse.json({ error: "El hash SHA-256 es requerido" }, { status: 400 });
    }

    // Ejecutar detector inteligente de metadatos
    const detectedMetadata = filename
      ? detectDocumentMetadata(filename, rawExtractedText, allSubjects)
      : null;

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
        detectedMetadata,
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
        detectedMetadata,
        message: `Este documento ya fue enviado por otro estudiante y se encuentra en revisión.`,
      });
    }

    // 3. Advertencia suave si existe un documento similar por metadatos
    let similarDoc = null;
    const effectiveSubjectId = detectedMetadata?.subjectId || subjectId;
    const effectiveCategory = detectedMetadata?.category || category;
    const effectiveSubcategory = detectedMetadata?.subcategory || subcategory;

    if (effectiveSubjectId && effectiveCategory && effectiveSubcategory) {
      similarDoc = await prisma.document.findFirst({
        where: {
          subjectId: effectiveSubjectId,
          category: effectiveCategory as "CLASE" | "LECCION" | "TALLER" | "EXAMEN",
          subcategory: effectiveSubcategory,
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
      detectedMetadata,
      similar: similarDoc
        ? {
            title: similarDoc.title,
            period: `${similarDoc.periodYear > 0 ? similarDoc.periodYear : "S/F"} - ${similarDoc.periodTerm}`,
          }
        : null,
    });
  } catch (error) {
    console.error("Error checking duplicate:", error);
    return NextResponse.json({ error: "Error al verificar duplicados" }, { status: 500 });
  }
}
