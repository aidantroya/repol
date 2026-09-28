"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { 
  BookOpen, 
  UploadCloud, 
  ShieldCheck, 
  User as UserIcon, 
  LogOut, 
  Award, 
  Sparkles, 
  LogIn,
  Lightbulb
} from "lucide-react";
import { FeedbackModal } from "./FeedbackModal";

export function Navbar() {
  const { data: session } = useSession();
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const user = session?.user;
  const isAdmin = user?.role === "ADMIN" || user?.role === "MODERATOR";
  const contributions = user?.approvedContributions || 0;
  const progressPercent = Math.min(100, Math.round((contributions / 10) * 100));

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* Logo & Marca */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-bold tracking-tight text-white font-sans">
                    Re<span className="text-blue-500">Pol</span>
                  </span>
                  <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-500/20">
                    Académico
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 hidden sm:block">Repositorio Universitario Colaborativo</p>
              </div>
            </Link>
          </div>

          {/* Acciones principales & Perfil */}
          <div className="flex items-center gap-3">
            
            {/* Barra de progreso de contribución si está autenticado */}
            {user && (
              <Link
                href="/profile"
                className="hidden md:flex items-center gap-3 rounded-full bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 text-xs hover:border-zinc-700 transition"
                title="Tu progreso de contribuciones para alcanzar rango de Administrador"
              >
                <Award className={`h-4 w-4 ${contributions >= 10 ? "text-amber-400" : "text-zinc-400"}`} />
                <div className="flex flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-zinc-300 font-medium">Nivel de Contribución:</span>
                    <span className="font-semibold text-white">{contributions}/10</span>
                  </div>
                  <div className="h-1.5 w-28 rounded-full bg-zinc-800 overflow-hidden mt-0.5">
                    <div
                      className={`h-full transition-all duration-500 ${
                        contributions >= 10 ? "bg-amber-400" : "bg-gradient-to-r from-blue-500 to-indigo-500"
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </Link>
            )}

            {/* Botón Sugerencias & Bugs */}
            <button
              onClick={() => setFeedbackModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 hover:border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white transition"
              title="Reportar un bug o sugerir mejoras para RePol"
            >
              <Lightbulb className="h-4 w-4 text-amber-400" />
              <span className="hidden sm:inline">Sugerencias & Bugs</span>
            </button>

            {/* Botón Subir Documento */}
            <Link
              href="/upload"
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500 hover:shadow-blue-500/30 transition-all active:scale-95"
            >
              <UploadCloud className="h-4 w-4" />
              <span>Subir Documento</span>
            </Link>

            {/* Enlace al Panel Admin si es Admin */}
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-xs sm:text-sm font-semibold text-amber-400 hover:bg-amber-500/25 transition"
              >
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                <span className="hidden sm:inline">Panel Admin</span>
              </Link>
            )}

            {/* Usuario autenticado o botón de inicio */}
            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 p-1.5 sm:px-3 sm:py-1.5 hover:border-zinc-700 transition"
                >
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt={user.name || "Usuario"} className="h-7 w-7 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
                      <UserIcon className="h-4 w-4" />
                    </div>
                  )}
                  <div className="hidden lg:block text-left text-xs">
                    <div className="font-medium text-zinc-200 truncate max-w-[120px]">{user.name || user.email}</div>
                    <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                      {isAdmin ? (
                        <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                          <Sparkles className="h-3 w-3" /> Admin
                        </span>
                      ) : (
                        "Estudiante"
                      )}
                    </div>
                  </div>
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/auth/signin"
                className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs sm:text-sm font-semibold text-zinc-200 hover:border-zinc-500 hover:text-white transition"
              >
                <LogIn className="h-4 w-4" />
                <span>Ingresar</span>
              </Link>
            )}

          </div>
        </div>
      </header>

      {/* Modal interactivo de Feedback */}
      <FeedbackModal
        isOpen={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
      />
    </>
  );
}
