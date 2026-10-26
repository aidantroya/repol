"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

interface AnalyticsData {
  activeUsers: number;
  totalVisits: number;
}

export function useActiveAnalytics() {
  const [data, setData] = useState<AnalyticsData>({
    activeUsers: 1,
    totalVisits: 1,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Obtener o generar identificador de sesión local (único por pestaña/navegador)
    let sessionId = sessionStorage.getItem("repol_session_id");
    if (!sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem("repol_session_id", sessionId);
    }

    // Comprobar si es una visita nueva en esta sesión
    const hasVisited = sessionStorage.getItem("repol_visited_recorded");
    const isNewVisit = !hasVisited;

    const sendHeartbeat = async (firstVisit = false) => {
      try {
        const res = await fetch("/api/analytics/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            isNewVisit: firstVisit,
          }),
        });

        if (res.ok) {
          const result = await res.json();
          setData({
            activeUsers: Math.max(1, result.activeUsers || 1),
            totalVisits: Math.max(1, result.totalVisits || 1),
          });
          if (firstVisit) {
            sessionStorage.setItem("repol_visited_recorded", "true");
          }
        }
      } catch (err) {
        // Fallback silencioso en caso de desconexión momentánea
        console.debug("[Analytics] heartbeat skipped:", err);
      }
    };

    // 1. Envío inicial
    sendHeartbeat(isNewVisit);

    // 2. Intervalo regular de 2.5 minutos (150 segundos) para mantener la app despierta
    const interval = setInterval(() => {
      // Solo enviar señal si el usuario tiene la pestaña visible para ahorrar recursos
      if (document.visibilityState === "visible") {
        sendHeartbeat(false);
      }
    }, 150000);

    // 3. Cuando el usuario vuelve a enfocar la pestaña, actualizar inmediatamente
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return data;
}

/**
 * Pastilla visual para el Navbar:
 * Muestra el punto verde pulsante y la cantidad de estudiantes activos
 */
export function NavbarActiveUsersBadge() {
  const { activeUsers, totalVisits } = useActiveAnalytics();

  return (
    <div
      className="flex items-center gap-2 rounded-full bg-zinc-900/90 border border-zinc-800 px-2.5 sm:px-3 py-1 text-xs text-zinc-300 shadow-sm transition hover:border-zinc-700"
      title={`Actualmente hay ${activeUsers} estudiante${activeUsers === 1 ? "" : "s"} navegando en RePol • ${totalVisits.toLocaleString("es-EC")} visitas totales registradas`}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span className="font-semibold text-white">
        {activeUsers}
      </span>
      <span className="hidden sm:inline text-zinc-400 text-[11px]">
        {activeUsers === 1 ? "estudiante activo" : "estudiantes activos"}
      </span>
    </div>
  );
}

/**
 * Bloque visual para el Footer:
 * Muestra estudiantes en línea y total de visitas acumuladas
 */
export function FooterLiveMetrics({ activeUsers, totalVisits }: AnalyticsData) {
  return (
    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-zinc-400">
      <div className="flex items-center gap-1.5 rounded-md bg-zinc-900/80 border border-zinc-800/80 px-2 py-1">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-zinc-200 font-medium">
          {activeUsers} {activeUsers === 1 ? "estudiante en línea" : "estudiantes en línea"}
        </span>
      </div>

      <div className="flex items-center gap-1.5 rounded-md bg-zinc-900/80 border border-zinc-800/80 px-2 py-1 text-zinc-400">
        <Eye className="h-3.5 w-3.5 text-blue-400" />
        <span>
          <strong className="text-zinc-200">{totalVisits.toLocaleString("es-EC")}</strong> visitas registradas
        </span>
      </div>
    </div>
  );
}
