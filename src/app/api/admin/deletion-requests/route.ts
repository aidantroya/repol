import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logModeratorAction } from "@/lib/audit";

// GET: Obtener solicitudes de eliminación (Solo Staff: ADMIN y MODERATOR)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      where.status = status;
    }

    const requests = await prisma.documentDeletionRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        document: {
          include: {
            subject: true,
            uploadedBy: {
              select: { name: true, email: true },
            },
          },
        },
        requestedBy: {
          select: { id: true, name: true, email: true, image: true, role: true },
        },
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Error al obtener solicitudes de eliminación:", error);
    return NextResponse.json(
      { error: "Error interno al consultar solicitudes de eliminación." },
      { status: 500 }
    );
  }
}

// POST: Crear una solicitud de eliminación de documento (Moderadores y Admins)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "MODERATOR")) {
      return NextResponse.json(
        { error: "No autorizado. Se requieren permisos de moderador o administrador." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { documentId, reason } = body;

    if (!documentId) {
      return NextResponse.json({ error: "El ID del documento es obligatorio." }, { status: 400 });
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return NextResponse.json(
        { error: "Debes ingresar una justificación o motivo detallado para solicitar la eliminación (mínimo 5 caracteres)." },
        { status: 400 }
      );
    }

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: { subject: true },
    });

    if (!doc) {
      return NextResponse.json(
        { error: "El documento seleccionado no existe o ya fue eliminado." },
        { status: 404 }
      );
    }

    // Verificar si ya existe una solicitud pendiente para este documento
    const existingPending = await prisma.documentDeletionRequest.findFirst({
      where: {
        documentId,
        status: "PENDING",
      },
    });

    if (existingPending) {
      return NextResponse.json(
        { error: "Ya existe una solicitud de eliminación pendiente de revisión para este documento." },
        { status: 400 }
      );
    }

    const newRequest = await prisma.documentDeletionRequest.create({
      data: {
        documentId,
        reason: reason.trim(),
        requestedById: session.user.id,
        status: "PENDING",
      },
      include: {
        document: {
          include: { subject: true },
        },
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await logModeratorAction({
      userId: session.user.id,
      action: "DELETION_REQUEST_CREATED",
      targetType: "DOCUMENT",
      targetId: doc.id,
      targetTitle: doc.title,
      details: `Solicitó eliminación del documento "${doc.title}" (${doc.subject.name} - ${doc.subject.code}). Motivo: "${reason.trim()}"`,
      metadata: {
        documentId: doc.id,
        subjectCode: doc.subject.code,
        category: doc.category,
        periodYear: doc.periodYear,
        periodTerm: doc.periodTerm,
        reason: reason.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Solicitud de eliminación enviada al Administrador con éxito.",
      request: newRequest,
    });
  } catch (error) {
    console.error("Error al crear solicitud de eliminación:", error);
    return NextResponse.json(
      { error: "Error interno al procesar la solicitud de eliminación." },
      { status: 500 }
    );
  }
}

// PATCH: Aprobar o Rechazar solicitud de eliminación (Exclusivo para ADMIN)
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acceso denegado: Solo el Administrador principal puede aprobar o rechazar solicitudes de eliminación." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { requestId, action, reviewNotes } = body;

    if (!requestId || !action || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json(
        { error: "Se requiere requestId y una acción válida (APPROVE o REJECT)." },
        { status: 400 }
      );
    }

    const request = await prisma.documentDeletionRequest.findUnique({
      where: { id: requestId },
      include: {
        document: {
          include: { subject: true },
        },
        requestedBy: true,
      },
    });

    if (!request) {
      return NextResponse.json(
        { error: "La solicitud de eliminación no existe." },
        { status: 404 }
      );
    }

    if (request.status !== "PENDING") {
      return NextResponse.json(
        { error: `Esta solicitud ya fue procesada anteriormente con estado: ${request.status}.` },
        { status: 400 }
      );
    }

    if (action === "APPROVE") {
      const docTitle = request.document.title;
      const docSubject = request.document.subject.name;
      const docCode = request.document.subject.code;
      const docId = request.documentId;

      // Registrar auditoría antes del borrado en cascada
      await logModeratorAction({
        userId: session.user.id,
        action: "DOCUMENT_DELETED",
        targetType: "DOCUMENT",
        targetId: docId,
        targetTitle: docTitle,
        details: `Aprobó solicitud de eliminación de ${request.requestedBy.name || request.requestedBy.email} para el documento "${docTitle}" (${docSubject} - ${docCode}). Justificación del moderador: "${request.reason}". ${reviewNotes ? `Nota de aprobación: "${reviewNotes}"` : ""}`,
        metadata: {
          deletedViaRequest: true,
          requestId: request.id,
          requestedById: request.requestedById,
          requestedByEmail: request.requestedBy.email,
          reason: request.reason,
          reviewNotes: reviewNotes || null,
        },
      });

      // Eliminar el documento del catálogo oficial
      await prisma.document.delete({
        where: { id: docId },
      });

      return NextResponse.json({
        success: true,
        message: `Solicitud aprobada y documento "${docTitle}" eliminado exitosamente del repositorio.`,
      });
    } else {
      // Rechazar solicitud de eliminación
      const updatedRequest = await prisma.documentDeletionRequest.update({
        where: { id: requestId },
        data: {
          status: "REJECTED",
          reviewedById: session.user.id,
          reviewedAt: new Date(),
          reviewNotes: reviewNotes?.trim() || "Solicitud rechazada por el Administrador.",
        },
      });

      await logModeratorAction({
        userId: session.user.id,
        action: "DELETION_REQUEST_REJECTED",
        targetType: "DOCUMENT",
        targetId: request.documentId,
        targetTitle: request.document?.title || "Documento",
        details: `Rechazó solicitud de eliminación enviada por ${request.requestedBy.name || request.requestedBy.email}. Motivo del rechazo: "${reviewNotes?.trim() || "No cumple con los criterios de retiro"}"`,
        metadata: {
          requestId: request.id,
          requestedById: request.requestedById,
          moderatorReason: request.reason,
          adminNotes: reviewNotes?.trim() || null,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Solicitud de eliminación rechazada.",
        request: updatedRequest,
      });
    }
  } catch (error) {
    console.error("Error al procesar solicitud de eliminación:", error);
    return NextResponse.json(
      { error: "Error interno al procesar la solicitud de eliminación." },
      { status: 500 }
    );
  }
}
