import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Obtener solicitudes de ascenso a Admin (para administradores o del usuario actual)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (session.user.role === "ADMIN") {
      const requests = await prisma.adminPromotionRequest.findMany({
        include: {
          user: {
            select: { id: true, name: true, email: true, approvedContributions: true, image: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ requests });
    } else {
      const requests = await prisma.adminPromotionRequest.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ requests });
    }
  } catch (error) {
    console.error("Error fetching promotions:", error);
    return NextResponse.json({ error: "Error al consultar promociones" }, { status: 500 });
  }
}

// Solicitar ascenso a Administrador (requiere al menos 10 contribuciones aprobadas)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { reason } = await req.json();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (user.role === "ADMIN") {
      return NextResponse.json({ error: "Ya eres administrador de la plataforma." }, { status: 400 });
    }

    if (user.approvedContributions < 10) {
      return NextResponse.json(
        {
          error: `Necesitas al menos 10 documentos aprobados para solicitar el rol de Administrador. Actualmente tienes ${user.approvedContributions}.`,
        },
        { status: 400 }
      );
    }

    // Verificar si ya tiene una solicitud pendiente
    const existing = await prisma.adminPromotionRequest.findFirst({
      where: { userId: user.id, status: "PENDING" },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Ya tienes una solicitud de ascenso en revisión por el equipo." },
        { status: 400 }
      );
    }

    const newRequest = await prisma.adminPromotionRequest.create({
      data: {
        userId: user.id,
        reason: reason || "He alcanzado las 10 contribuciones académicas aprobadas.",
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      message: "¡Solicitud enviada con éxito! Un administrador la evaluará pronto.",
      request: newRequest,
    });
  } catch (error) {
    console.error("Error requesting promotion:", error);
    return NextResponse.json({ error: "Error al procesar solicitud" }, { status: 500 });
  }
}

// Aprobar solicitud de administrador
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Solo los administradores pueden otorgar nuevos roles." }, { status: 403 });
    }

    const { requestId, action } = await req.json();

    if (!requestId || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const promotion = await prisma.adminPromotionRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!promotion) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }

    if (action === "REJECT") {
      await prisma.adminPromotionRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED", reviewedAt: new Date() },
      });
      return NextResponse.json({ success: true, message: "Solicitud rechazada" });
    }

    // Promover usuario a ADMIN
    await prisma.$transaction([
      prisma.adminPromotionRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", reviewedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: promotion.userId },
        data: { role: "ADMIN" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: `El usuario ${promotion.user.name || promotion.user.email} ha sido ascendido a Administrador.`,
    });
  } catch (error) {
    console.error("Error updating promotion:", error);
    return NextResponse.json({ error: "Error al actualizar rol" }, { status: 500 });
  }
}
