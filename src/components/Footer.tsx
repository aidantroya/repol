"use client";

import Link from "next/link";
import { useActiveAnalytics, FooterLiveMetrics } from "./ActiveUsersWidget";

export function Footer() {
  const analytics = useActiveAnalytics();

  return (
    <footer className="border-t border-zinc-900 bg-zinc-950 py-8 text-xs text-zinc-500">
      <div className="mx-auto max-w-7xl px-4 flex flex-col gap-6">
        
        {/* Métricas en vivo (usuarios activos en tiempo real + visitas totales) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-zinc-900/80">
          <FooterLiveMetrics {...analytics} />
          <p className="flex items-center gap-1.5 text-zinc-400 text-center sm:text-right">
            Directorio colaborativo estudiantil • Almacenamiento en Cloudflare R2
          </p>
        </div>

        {/* Enlaces y derechos de autor */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <p>© {new Date().getFullYear()} RePol - Repositorio Académico</p>
            <span className="hidden sm:inline text-zinc-700">•</span>
            <Link href="/feedback" className="text-zinc-400 hover:text-blue-400 underline-offset-4 hover:underline transition">
              Reportar Bug o Sugerencia
            </Link>
            <span className="hidden sm:inline text-zinc-700">•</span>
            <Link href="/informacion-adicional" className="text-zinc-400 hover:text-blue-400 underline-offset-4 hover:underline transition">
              Información adicional
            </Link>
          </div>
          <p className="text-zinc-500 text-[11px] text-center sm:text-right">
            ESPOL • Plataforma académica estudiantil
          </p>
        </div>

      </div>
    </footer>
  );
}
