import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DocumentCategory } from "@prisma/client";
import { computeSemanticContentHash } from "@/lib/content-hash";
import { 
  detectDocumentMetadataHybrid, 
  formatVersionedTitle, 
  extractVersionFromTitle 
} from "@/lib/metadata-detector";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let fileHash = "";
    let semanticHash = "";
    let subjectId = "";
    let category = "";
    let subcategory = "";
    let title = "";
    let periodYear = "";
    let periodTerm = "";
    let filename = "";
    let rawExtractedText = "";
    let checkTitleOnly = false;

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
      title = (formData.get("title") as string) || "";
      periodYear = (formData.get("periodYear") as string) || "";
      periodTerm = (formData.get("periodTerm") as string) || "";

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
      fileHash = body.fileHash || "";
      semanticHash = body.semanticHash || body.fileHash || "";
      subjectId = body.subjectId || "";
      category = body.category || "";
      subcategory = body.subcategory || "";
      title = body.title || "";
      periodYear = body.periodYear || "";
      periodTerm = body.periodTerm || "";
      filename = body.filename || "";
      rawExtractedText = body.rawText || "";
      checkTitleOnly = Boolean(body.checkTitleOnly);
    }

    // Ejecutar detector híbrido (IA primaria con fallback a reglas)
    const detectedMetadata = filename
      ? await detectDocumentMetadataHybrid(filename, rawExtractedText, allSubjects)
      : null;

    const effectiveSubjectId = subjectId || detectedMetadata?.subjectId || "";
    const effectiveCategory = category || detectedMetadata?.category || "";
    const effectiveSubcategory = subcategory || detectedMetadata?.subcategory || "";
    const effectiveTitle = title || detectedMetadata?.suggestedTitle || "";
    const effectiveYearNum = parseInt(periodYear || detectedMetadata?.periodYear || "0", 10) || 0;
    const effectiveTerm = periodTerm || detectedMetadata?.periodTerm || "";

    // Función auxiliar para verificar si ya existe un examen por nombre / periodo en la misma materia
    async function checkExamDuplicateByName() {
      if (effectiveCategory !== "EXAMEN" || !effectiveSubjectId) {
        return null;
      }

      const orConditions: Array<{
        title?: { equals: string; mode: "insensitive" };
        subcategory?: string;
        periodYear?: number;
        periodTerm?: string;
      }> = [];

      if (effectiveTitle.trim().length >= 3) {
        orConditions.push({ title: { equals: effectiveTitle.trim(), mode: "insensitive" } });
      }

      if (effectiveYearNum > 0 && effectiveTerm && effectiveSubcategory) {
        orConditions.push({
          subcategory: effectiveSubcategory,
          periodYear: effectiveYearNum,
          periodTerm: effectiveTerm,
        });
      }

      if (orConditions.length === 0) return null;

      // 1. Buscar en documentos publicados
      const existingExamDoc = await prisma.document.findFirst({
        where: {
          subjectId: effectiveSubjectId,
          category: "EXAMEN",
          OR: orConditions,
        },
        select: {
          id: true,
          title: true,
          subcategory: true,
          periodYear: true,
          periodTerm: true,
        },
      });

      if (existingExamDoc) {
        return {
          exists: true,
          title: existingExamDoc.title,
          subcategory: existingExamDoc.subcategory,
          periodYear: existingExamDoc.periodYear,
          periodTerm: existingExamDoc.periodTerm,
          isPending: false,
          message: `Ya existe un examen publicado con este título/periodo ("${existingExamDoc.title}") en esta materia. Revisa si este archivo ya se encuentra en RePol o si el nombre generado debe ajustarse.`,
        };
      }

      // 2. Buscar en solicitudes de subida pendientes
      const pendingExamDoc = await prisma.submission.findFirst({
        where: {
          subjectId: effectiveSubjectId,
          category: "EXAMEN",
          status: "PENDING",
          OR: orConditions,
        },
        select: {
          id: true,
          title: true,
          subcategory: true,
          periodYear: true,
          periodTerm: true,
        },
      });

      if (pendingExamDoc) {
        return {
          exists: true,
          title: pendingExamDoc.title,
          subcategory: pendingExamDoc.subcategory,
          periodYear: pendingExamDoc.periodYear,
          periodTerm: pendingExamDoc.periodTerm,
          isPending: true,
          message: `Existe un examen enviado en revisión con este título/periodo ("${pendingExamDoc.title}") en esta materia.`,
        };
      }

      return null;
    }

    // Si es solo una verificación ligera en tiempo real de título para exámenes
    if (checkTitleOnly) {
      const possibleExamDuplicate = await checkExamDuplicateByName();
      return NextResponse.json({
        exists: false,
        possibleExamDuplicate,
      });
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

    // 3. Verificación especial de examen duplicado por nombre/periodo (solo para exámenes)
    const possibleExamDuplicate = await checkExamDuplicateByName();

    // 4. Para actividades que NO son exámenes (Lecciones, Talleres, etc.), si tienen diferente hash pero coinciden en materia, año, periodo y subcategoría, calcular la versión v2, v3, etc.
    let suggestedVersion = 1;
    let versionedTitle = effectiveTitle;

    if (effectiveCategory !== "EXAMEN" && effectiveSubjectId && effectiveSubcategory) {
      const existingSameCategoryDocs = await prisma.document.findMany({
        where: {
          subjectId: effectiveSubjectId,
          category: effectiveCategory as DocumentCategory,
          subcategory: effectiveSubcategory,
          periodYear: effectiveYearNum,
          periodTerm: effectiveTerm || undefined,
        },
        select: { title: true },
      });

      const existingSameCategorySubs = await prisma.submission.findMany({
        where: {
          subjectId: effectiveSubjectId,
          category: effectiveCategory as DocumentCategory,
          subcategory: effectiveSubcategory,
          periodYear: effectiveYearNum,
          periodTerm: effectiveTerm || undefined,
          status: "PENDING",
        },
        select: { title: true },
      });

      const allMatchingTitles = [
        ...existingSameCategoryDocs.map((d) => d.title),
        ...existingSameCategorySubs.map((s) => s.title),
      ];

      if (allMatchingTitles.length > 0) {
        const versions = allMatchingTitles.map((t) => extractVersionFromTitle(t));
        const maxExistingVersion = Math.max(1, ...versions);
        suggestedVersion = maxExistingVersion + 1;
        versionedTitle = formatVersionedTitle(effectiveTitle, suggestedVersion);
      }
    }

    const finalMetadata = detectedMetadata
      ? {
          ...detectedMetadata,
          suggestedTitle: versionedTitle,
          version: suggestedVersion,
        }
      : null;

    return NextResponse.json({
      exists: false,
      fileHash,
      detectedMetadata: finalMetadata,
      suggestedVersion,
      suggestedTitle: versionedTitle,
      possibleExamDuplicate,
    });
  } catch (error) {
    console.error("Error checking duplicate:", error);
    return NextResponse.json({ error: "Error al verificar duplicados" }, { status: 500 });
  }
}
