import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logModeratorAction } from "@/lib/audit";

// Obtener todas las solicitudes pendientes para revisión administrativa
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Acceso denegado. Se requieren permisos administrativos." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "PENDING";

    const submissions = await prisma.submission.findMany({
      where: status !== "ALL" ? { status: status as "PENDING" | "APPROVED" | "REJECTED" } : {},
      include: {
        user: {
          select: { id: true, name: true, email: true, approvedContributions: true, image: true },
        },
        subject: {
          include: {
            careers: {
              include: { career: true },
            },
          },
        },
        reviewedBy: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ submissions });
  } catch (error) {
    console.error("Error fetching admin submissions:", error);
    return NextResponse.json({ error: "Error al consultar solicitudes" }, { status: 500 });
  }
}

// Aprobar o rechazar solicitud
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { submissionId, action, rejectionReason } = await req.json();

    if (!submissionId || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { subject: true, user: true },
    });

    if (!submission) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    if (submission.status !== "PENDING") {
      return NextResponse.json({ error: "Esta solicitud ya fue procesada previamente" }, { status: 400 });
    }

    if (action === "REJECT") {
      const updated = await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: "REJECTED",
          rejectionReason: rejectionReason || "El documento no cumple con los criterios de calidad o formato.",
          reviewedById: session.user.id,
          reviewedAt: new Date(),
        },
      });

      await logModeratorAction({
        userId: session.user.id,
        action: "SUBMISSION_REJECTED",
        targetType: "SUBMISSION",
        targetId: submission.id,
        targetTitle: submission.title,
        details: `Rechazó solicitud: "${submission.title}" en ${submission.subject.name} (${submission.subject.code}). Motivo: ${rejectionReason || "No cumple criterios"}`,
        metadata: {
          rejectionReason: rejectionReason || "No cumple criterios",
          subjectCode: submission.subject.code,
          category: submission.category,
          authorEmail: submission.user.email,
        },
      });

      return NextResponse.json({ success: true, message: "Documento rechazado con éxito", submission: updated });
    }

    // Acción: APROBAR -> Crear documento en la tabla pública en transacción y aumentar contribuciones
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear documento en la tabla pública
      const newDocument = await tx.document.create({
        data: {
          title: submission.title,
          description: submission.description,
          fileHash: submission.fileHash,
          fileSize: submission.fileSize,
          mimeType: submission.mimeType,
          storageKey: submission.storageKey,
          fileUrl: submission.fileUrl,
          attachments: submission.attachments ?? undefined,
          category: submission.category,
          subcategory: submission.subcategory,
          customDescription: submission.customDescription,
          periodYear: submission.periodYear,
          periodTerm: submission.periodTerm,
          subjectId: submission.subjectId,
          uploadedById: submission.userId,
        },
      });

      // 2. Marcar submission como aprobada
      const updatedSubmission = await tx.submission.update({
        where: { id: submissionId },
        data: {
          status: "APPROVED",
          reviewedById: session.user.id,
          reviewedAt: new Date(),
        },
      });

      // 3. Incrementar contador de contribuciones aprobadas del autor
      const updatedUser = await tx.user.update({
        where: { id: submission.userId },
        data: {
          approvedContributions: { increment: 1 },
        },
      });

      return { document: newDocument, submission: updatedSubmission, user: updatedUser };
    });

    await logModeratorAction({
      userId: session.user.id,
      action: "SUBMISSION_APPROVED",
      targetType: "SUBMISSION",
      targetId: submission.id,
      targetTitle: submission.title,
      details: `Aprobó y publicó: "${submission.title}" en ${submission.subject.name} (${submission.subject.code}) [${submission.category} - ${submission.subcategory}]`,
      metadata: {
        documentId: result.document.id,
        subjectCode: submission.subject.code,
        category: submission.category,
        authorEmail: submission.user.email,
      },
    });

    return NextResponse.json({
      success: true,
      message: "¡Documento aprobado exitosamente y publicado en el repositorio global!",
      result,
    });
  } catch (error) {
    console.error("Error updating submission:", error);
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 });
  }
}
