import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Almacenamiento en memoria para dispositivos activos (0 consultas de BD para presencia periódica)
const activeDevices = new Map<string, number>();
const SESSION_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutos de inactividad

// Caché en memoria para el contador total de visitas únicas
let cachedTotalVisits: number | null = null;
let lastCacheUpdate = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // Refrescar visitas cada 2 minutos

function pruneExpiredDevices() {
  const now = Date.now();
  for (const [id, lastSeen] of activeDevices.entries()) {
    if (now - lastSeen > SESSION_TIMEOUT_MS) {
      activeDevices.delete(id);
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawDeviceId =
      typeof body.deviceId === "string"
        ? body.deviceId
        : typeof body.sessionId === "string"
        ? body.sessionId
        : null;

    const deviceId = rawDeviceId ? rawDeviceId.trim().slice(0, 128) : null;
    let isNewVisit = Boolean(body.isNewVisit);

    // 1. Verificar cookies de solicitud
    const cookieHeader = req.headers.get("cookie") || "";
    const hasRecordedCookie = cookieHeader.includes("repol_device_recorded=1");

    if (hasRecordedCookie) {
      // Si la cookie persistente existe, este dispositivo ya fue contado con total seguridad
      isNewVisit = false;
    }

    // 2. Registrar presencia en memoria (1 dispositivo = 1 usuario activo, sin importar cuántas pestañas tenga)
    if (deviceId) {
      activeDevices.set(deviceId, Date.now());
    }
    pruneExpiredDevices();

    const activeUsers = Math.max(1, activeDevices.size);

    // 3. Procesar incremento de visita solo si es un dispositivo nuevo no registrado
    if (isNewVisit && deviceId) {
      try {
        // Registrar en tabla VisitedDevice. Si ya existía, PostgreSQL lanzará error P2002 de clave única
        await prisma.visitedDevice.create({
          data: { id: deviceId },
        });

        // Solo si la creación en VisitedDevice fue exitosa, incrementamos el contador global
        const stat = await prisma.siteStat.upsert({
          where: { id: "global" },
          update: { totalVisits: { increment: 1 } },
          create: { id: "global", totalVisits: 1 },
        });
        cachedTotalVisits = stat.totalVisits;
        lastCacheUpdate = Date.now();
      } catch (dbErr: unknown) {
        const hasCode = typeof dbErr === "object" && dbErr !== null && "code" in dbErr;
        if (hasCode && (dbErr as { code: string }).code === "P2002") {
          // El dispositivo ya estaba registrado en Neon DB -> no contar como nueva visita
        } else {
          console.warn("[Analytics] Advertencia registrando dispositivo en Neon DB:", dbErr);
        }
      }
    }

    // 4. Refrescar caché de visitas si expiró o aún no está en memoria
    if (cachedTotalVisits === null || Date.now() - lastCacheUpdate > CACHE_TTL_MS) {
      try {
        const stat = await prisma.siteStat.findUnique({
          where: { id: "global" },
        });
        cachedTotalVisits = stat?.totalVisits ?? 1;
        lastCacheUpdate = Date.now();
      } catch (readErr) {
        console.warn("[Analytics] Error leyendo visitas de Neon DB:", readErr);
        if (cachedTotalVisits === null) cachedTotalVisits = 1;
      }
    }

    // 5. Devolver respuesta con cookies de persistencia (10 años)
    const res = NextResponse.json(
      {
        activeUsers,
        totalVisits: cachedTotalVisits ?? 1,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );

    if (deviceId) {
      res.cookies.set({
        name: "repol_device_recorded",
        value: "1",
        path: "/",
        maxAge: 315360000, // 10 años
        sameSite: "lax",
      });
      res.cookies.set({
        name: "repol_device_id",
        value: deviceId,
        path: "/",
        maxAge: 315360000,
        sameSite: "lax",
      });
    }

    return res;
  } catch (error) {
    console.error("[Analytics] Error en endpoint heartbeat:", error);
    return NextResponse.json(
      { activeUsers: 1, totalVisits: cachedTotalVisits ?? 1 },
      { status: 200 }
    );
  }
}

export async function GET() {
  pruneExpiredDevices();
  const activeUsers = Math.max(1, activeDevices.size);

  if (cachedTotalVisits === null || Date.now() - lastCacheUpdate > CACHE_TTL_MS) {
    try {
      const stat = await prisma.siteStat.findUnique({
        where: { id: "global" },
      });
      cachedTotalVisits = stat?.totalVisits ?? 1;
      lastCacheUpdate = Date.now();
    } catch {
      if (cachedTotalVisits === null) cachedTotalVisits = 1;
    }
  }

  return NextResponse.json(
    {
      activeUsers,
      totalVisits: cachedTotalVisits ?? 1,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
