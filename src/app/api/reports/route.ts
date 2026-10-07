import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReportReason, ReportStatus } from "@prisma/client";
import { logModeratorAction } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { documentId, reason, details, reporterEmail } = body;

    if (!documentId) {
      return NextResponse.json({ error: "El ID del documento es obligatorio." }, { status: 400 });
    }

    if (!reason || !Object.values(ReportReason).includes(reason)) {
      return NextResponse.json({ error: "Debe seleccionar un motivo válido para el reporte." }, { status: 400 });
    }

    // Verificar que el documento exista
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      return NextResponse.json({ error: "El documento indicado no existe o ya fue retirado." }, { status: 404 });
    }

    const report = await prisma.documentReport.create({
      data: {
        documentId,
        reason: reason as ReportReason,
        details: details?.trim() || null,
        reporterEmail: reporterEmail?.trim() || session?.user?.email || null,
        userId: session?.user?.id || null,
        status: ReportStatus.PENDING,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Reporte recibido exitosamente. Nuestro equipo revisará la solicitud a la brevedad.",
      reportId: report.id,
    });
  } catch (error) {
    console.error("Error al registrar reporte de documento:", error);
    return NextResponse.json(
      { error: "Ocurrió un error al procesar el reporte. Inténtalo nuevamente." },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user.role !== "ADMIN" && session.user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "No autorizado. Se requieren permisos de moderador o administrador." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");

    const where: { status?: ReportStatus } = {};
    if (statusParam && Object.values(ReportStatus).includes(statusParam as ReportStatus)) {
      where.status = statusParam as ReportStatus;
    }

    const reports = await prisma.documentReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        document: {
          include: {
            subject: {
              include: {
                careers: {
                  include: {
                    career: true,
                  },
                },
              },
            },
            uploadedBy: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ reports });
  } catch (error) {
    console.error("Error al obtener reportes:", error);
    return NextResponse.json({ error: "Error interno del servidor al consultar reportes." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user.role !== "ADMIN" && session.user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const body = await req.json();
    const { reportId, status, notes } = body;

    if (!reportId || !status || !Object.values(ReportStatus).includes(status)) {
      return NextResponse.json({ error: "Datos de actualización inválidos." }, { status: 400 });
    }

    const updated = await prisma.documentReport.update({
      where: { id: reportId },
      data: {
        status: status as ReportStatus,
        notes: notes !== undefined ? notes : undefined,
      },
      include: {
        document: true,
      },
    });

    await logModeratorAction({
      userId: session.user.id,
      action: status === "RESOLVED" ? "REPORT_RESOLVED" : "REPORT_DISMISSED",
      targetType: "REPORT",
      targetId: reportId,
      targetTitle: updated.document?.title || "Reporte de Documento",
      details: `Marcó reporte como ${status === "RESOLVED" ? "RESUELTO" : "DESESTIMADO"}. Motivo original: ${updated.reason}. ${notes ? `Notas: "${notes}"` : ""}`,
      metadata: {
        reportReason: updated.reason,
        status,
        documentId: updated.documentId,
      },
    });

    return NextResponse.json({ success: true, report: updated });
  } catch (error) {
    console.error("Error al actualizar reporte:", error);
    return NextResponse.json({ error: "Error al actualizar estado del reporte." }, { status: 500 });
  }
}
