"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

interface AnalyticsData {
  activeUsers: number;
  totalVisits: number;
}

// Estado compartido global en memoria para todas las instancias del hook
let sharedData: AnalyticsData = { activeUsers: 1, totalVisits: 1 };
const listeners = new Set<(data: AnalyticsData) => void>();
let heartbeatInitialized = false;

function setAnalyticsData(newData: AnalyticsData) {
  sharedData = newData;
  listeners.forEach((listener) => listener(newData));
}

// Helper para obtener o generar el Device ID persistente (LocalStorage + Cookie de 10 años)
function getPersistentDeviceId(): string {
  let deviceId = "";
  try {
    deviceId = localStorage.getItem("repol_device_id") || "";
  } catch {}

  if (!deviceId && typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|; )repol_device_id=([^;]*)/);
    if (match && match[1]) {
      deviceId = decodeURIComponent(match[1]);
    }
  }

  if (!deviceId) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      deviceId = `dev_${crypto.randomUUID()}`;
    } else {
      deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
    }
  }

  try {
    localStorage.setItem("repol_device_id", deviceId);
  } catch {}

  if (typeof document !== "undefined") {
    document.cookie = `repol_device_id=${encodeURIComponent(deviceId)}; path=/; max-age=315360000; SameSite=Lax`;
  }

  return deviceId;
}

// Helper para comprobar si este dispositivo ya fue registrado previamente
function isDeviceAlreadyRecorded(): boolean {
  try {
    if (localStorage.getItem("repol_device_recorded") === "1") {
      return true;
    }
  } catch {}

  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|; )repol_device_recorded=([^;]*)/);
    if (match && match[1] === "1") {
      return true;
    }
  }

  return false;
}

function markDeviceRecorded(deviceId: string) {
  try {
    localStorage.setItem("repol_device_recorded", "1");
    localStorage.setItem("repol_device_id", deviceId);
  } catch {}

  if (typeof document !== "undefined") {
    document.cookie = `repol_device_recorded=1; path=/; max-age=315360000; SameSite=Lax`;
    document.cookie = `repol_device_id=${encodeURIComponent(deviceId)}; path=/; max-age=315360000; SameSite=Lax`;
  }
}

function startGlobalHeartbeat() {
  if (heartbeatInitialized || typeof window === "undefined") return;
  heartbeatInitialized = true;

  const deviceId = getPersistentDeviceId();
  const isNewVisit = !isDeviceAlreadyRecorded();

  const sendHeartbeat = async (recordAsNew: boolean) => {
    try {
      const res = await fetch("/api/analytics/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          isNewVisit: recordAsNew,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setAnalyticsData({
          activeUsers: Math.max(1, result.activeUsers || 1),
          totalVisits: Math.max(1, result.totalVisits || 1),
        });

        // Registrar persistentemente en cliente
        markDeviceRecorded(deviceId);
      }
    } catch (err) {
      console.debug("[Analytics] heartbeat skipped:", err);
    }
  };

  // 1. Envío inicial (solo isNewVisit=true si el dispositivo NUNCA antes ha sido registrado)
  sendHeartbeat(isNewVisit);

  // 2. Intervalo periódico de 2.5 min para mantener Render activo (siempre recordAsNew=false)
  setInterval(() => {
    if (document.visibilityState === "visible") {
      sendHeartbeat(false);
    }
  }, 150000);

  // 3. Al re-enfocar la pestaña
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      sendHeartbeat(false);
    }
  });
}

export function useActiveAnalytics() {
  const [data, setData] = useState<AnalyticsData>(sharedData);

  useEffect(() => {
    startGlobalHeartbeat();

    listeners.add(setData);
    return () => {
      listeners.delete(setData);
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
