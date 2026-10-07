import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FeedbackType, FeedbackStatus } from "@prisma/client";
import { logModeratorAction } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { type, title, description, email } = body;

    if (!type || !Object.values(FeedbackType).includes(type)) {
      return NextResponse.json({ error: "Debe seleccionar un tipo de reporte válido." }, { status: 400 });
    }

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "El título o asunto es obligatorio." }, { status: 400 });
    }

    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json({ error: "La descripción del reporte o sugerencia es obligatoria." }, { status: 400 });
    }

    const feedback = await prisma.siteFeedback.create({
      data: {
        type: type as FeedbackType,
        title: title.trim(),
        description: description.trim(),
        email: email?.trim() || session?.user?.email || null,
        userId: session?.user?.id || null,
        status: FeedbackStatus.PENDING,
      },
    });

    return NextResponse.json({
      success: true,
      message: "¡Gracias por tu aporte! Tu reporte/sugerencia ha sido registrado y será revisado por el equipo de RePol.",
      feedbackId: feedback.id,
    });
  } catch (error) {
    console.error("Error al registrar feedback:", error);
    return NextResponse.json(
      { error: "Ocurrió un error al enviar tu reporte. Inténtalo nuevamente." },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user.role !== "ADMIN" && session.user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");
    const typeParam = searchParams.get("type");

    const where: { status?: FeedbackStatus; type?: FeedbackType } = {};
    if (statusParam && Object.values(FeedbackStatus).includes(statusParam as FeedbackStatus)) {
      where.status = statusParam as FeedbackStatus;
    }
    if (typeParam && Object.values(FeedbackType).includes(typeParam as FeedbackType)) {
      where.type = typeParam as FeedbackType;
    }

    const feedbacks = await prisma.siteFeedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({ feedbacks });
  } catch (error) {
    console.error("Error al consultar feedback:", error);
    return NextResponse.json({ error: "Error interno al obtener feedback." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user.role !== "ADMIN" && session.user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const body = await req.json();
    const { feedbackId, status, adminNotes } = body;

    if (!feedbackId || !status || !Object.values(FeedbackStatus).includes(status)) {
      return NextResponse.json({ error: "Datos de actualización inválidos." }, { status: 400 });
    }

    const updated = await prisma.siteFeedback.update({
      where: { id: feedbackId },
      data: {
        status: status as FeedbackStatus,
        adminNotes: adminNotes !== undefined ? adminNotes : undefined,
      },
    });

    await logModeratorAction({
      userId: session.user.id,
      action: status === "RESOLVED" ? "FEEDBACK_RESOLVED" : "FEEDBACK_DISMISSED",
      targetType: "FEEDBACK",
      targetId: feedbackId,
      targetTitle: updated.title,
      details: `Marcó feedback (${updated.type}) como ${status}. Asunto: "${updated.title}"`,
      metadata: { type: updated.type, status, adminNotes },
    });

    return NextResponse.json({ success: true, feedback: updated });
  } catch (error) {
    console.error("Error al actualizar feedback:", error);
    return NextResponse.json({ error: "Error al actualizar estado del reporte." }, { status: 500 });
  }
}
