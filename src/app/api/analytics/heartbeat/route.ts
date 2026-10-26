import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Almacenamiento en memoria para sesiones activas (0 consultas de BD para heartbeats normales)
const activeSessions = new Map<string, number>();
const SESSION_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutos de inactividad

// Caché en memoria para el contador total de visitas
let cachedTotalVisits: number | null = null;
let lastCacheUpdate = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // Refrescar visitas cada 2 minutos

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [id, lastSeen] of activeSessions.entries()) {
    if (now - lastSeen > SESSION_TIMEOUT_MS) {
      activeSessions.delete(id);
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null;
    const isNewVisit = Boolean(body.isNewVisit);

    // 1. Registrar presencia en memoria
    if (sessionId) {
      activeSessions.set(sessionId, Date.now());
    }
    pruneExpiredSessions();

    const activeUsers = Math.max(1, activeSessions.size);

    // 2. Si es una visita nueva (primera vez en la sesión del navegador), incrementar en Neon DB
    if (isNewVisit) {
      try {
        const stat = await prisma.siteStat.upsert({
          where: { id: "global" },
          update: { totalVisits: { increment: 1 } },
          create: { id: "global", totalVisits: 1 },
        });
        cachedTotalVisits = stat.totalVisits;
        lastCacheUpdate = Date.now();
      } catch (dbErr) {
        console.warn("[Analytics] Error incrementando visita en Neon DB:", dbErr);
        if (cachedTotalVisits !== null) cachedTotalVisits += 1;
      }
    } else if (cachedTotalVisits === null || Date.now() - lastCacheUpdate > CACHE_TTL_MS) {
      // 3. Refrescar caché de visitas si expiró o no existe
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
  } catch (error) {
    console.error("[Analytics] Error en endpoint heartbeat:", error);
    return NextResponse.json(
      { activeUsers: 1, totalVisits: cachedTotalVisits ?? 1 },
      { status: 200 }
    );
  }
}

export async function GET() {
  pruneExpiredSessions();
  const activeUsers = Math.max(1, activeSessions.size);

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
