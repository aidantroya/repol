import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, SUPER_ADMIN_EMAILS } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logModeratorAction } from "@/lib/audit";
import { Role } from "@prisma/client";

// Obtener lista de moderadores, sus estadísticas y el historial completo de auditoría
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acceso denegado: Esta vista es exclusiva para el Administrador Principal (Owner)." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const filterUserId = searchParams.get("userId");
    const filterAction = searchParams.get("action");

    // 1. Obtener todos los usuarios con rol MODERATOR o ADMIN
    const staffUsers = await prisma.user.findMany({
      where: {
        role: { in: [Role.ADMIN, Role.MODERATOR] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        approvedContributions: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { role: "asc" }, // ADMIN primero
        { createdAt: "asc" },
      ],
    });

    // 2. Calcular estadísticas individuales para cada moderador/admin
    const moderatorsWithStats = await Promise.all(
      staffUsers.map(async (mod) => {
        const isOwner = SUPER_ADMIN_EMAILS.includes(mod.email.toLowerCase());

        const [
          approvedSubs,
          rejectedSubs,
          docUpdates,
          docDeletes,
          resolvedReports,
          totalLogs,
          lastLog,
          lastReviewedSub,
        ] = await Promise.all([
          prisma.submission.count({
            where: { reviewedById: mod.id, status: "APPROVED" },
          }),
          prisma.submission.count({
            where: { reviewedById: mod.id, status: "REJECTED" },
          }),
          prisma.moderatorLog.count({
            where: { userId: mod.id, action: "DOCUMENT_UPDATED" },
          }),
          prisma.moderatorLog.count({
            where: { userId: mod.id, action: "DOCUMENT_DELETED" },
          }),
          prisma.moderatorLog.count({
            where: { userId: mod.id, action: "REPORT_RESOLVED" },
          }),
          prisma.moderatorLog.count({
            where: { userId: mod.id },
          }),
          prisma.moderatorLog.findFirst({
            where: { userId: mod.id },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          }),
          prisma.submission.findFirst({
            where: { reviewedById: mod.id },
            orderBy: { reviewedAt: "desc" },
            select: { reviewedAt: true },
          }),
        ]);

        // Determinar última actividad registrada
        const logDate = lastLog?.createdAt ? new Date(lastLog.createdAt).getTime() : 0;
        const subDate = lastReviewedSub?.reviewedAt ? new Date(lastReviewedSub.reviewedAt).getTime() : 0;
        const latestTimestamp = Math.max(logDate, subDate);
        const lastActiveAt = latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : null;

        return {
          ...mod,
          isOwner,
          stats: {
            approvedSubmissions: approvedSubs,
            rejectedSubmissions: rejectedSubs,
            updatedDocuments: docUpdates,
            deletedDocuments: docDeletes,
            resolvedReports: resolvedReports,
            totalActions: totalLogs + approvedSubs + rejectedSubs,
            lastActiveAt,
          },
        };
      })
    );

    // 3. Consultar logs de actividad (Audit Trail)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereLog: any = {};
    if (filterUserId) whereLog.userId = filterUserId;
    if (filterAction) whereLog.action = filterAction;

    const activityLogs = await prisma.moderatorLog.findMany({
      where: whereLog,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 150,
    });

    // 4. Totales globales para dashboard
    const totalApproved = moderatorsWithStats.reduce((acc, m) => acc + m.stats.approvedSubmissions, 0);
    const totalRejected = moderatorsWithStats.reduce((acc, m) => acc + m.stats.rejectedSubmissions, 0);
    const totalUpdates = moderatorsWithStats.reduce((acc, m) => acc + m.stats.updatedDocuments, 0);
    const totalDeletes = moderatorsWithStats.reduce((acc, m) => acc + m.stats.deletedDocuments, 0);

    return NextResponse.json({
      moderators: moderatorsWithStats,
      activityLogs,
      summary: {
        totalStaff: staffUsers.length,
        totalAdmins: staffUsers.filter((u) => u.role === Role.ADMIN).length,
        totalModerators: staffUsers.filter((u) => u.role === Role.MODERATOR).length,
        totalApproved,
        totalRejected,
        totalUpdates,
        totalDeletes,
      },
    });
  } catch (error) {
    console.error("Error fetching moderator activity:", error);
    return NextResponse.json({ error: "Error al consultar actividad de moderadores" }, { status: 500 });
  }
}

// Cambiar rol de un usuario (Promover a Moderador/Admin o revertir a Estudiante)
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Solo el Administrador Principal puede gestionar roles." }, { status: 403 });
    }

    const { targetUserId, newRole } = await req.json();

    if (!targetUserId || !newRole || !Object.values(Role).includes(newRole)) {
      return NextResponse.json({ error: "Parámetros inválidos para actualización de rol." }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    // Proteger al Super Admin principal
    if (SUPER_ADMIN_EMAILS.includes(targetUser.email.toLowerCase()) && newRole !== "ADMIN") {
      return NextResponse.json(
        { error: "No es posible remover los privilegios de Administrador Principal a la cuenta Owner." },
        { status: 400 }
      );
    }

    const previousRole = targetUser.role;

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole as Role },
    });

    // Registrar en auditoría
    await logModeratorAction({
      userId: session.user.id,
      action: "ROLE_UPDATED",
      targetType: "USER",
      targetId: targetUserId,
      targetTitle: targetUser.name || targetUser.email,
      details: `Modificó el rol de ${targetUser.name || targetUser.email} (${targetUser.email}) de ${previousRole} a ${newRole}`,
      metadata: {
        targetEmail: targetUser.email,
        previousRole,
        newRole,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Rol de ${targetUser.name || targetUser.email} actualizado a ${newRole} con éxito.`,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    return NextResponse.json({ error: "Error al actualizar rol del usuario." }, { status: 500 });
  }
}
