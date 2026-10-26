"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Lightbulb,
  PanelLeftClose,
  PanelLeftOpen,
  Home,
  Menu,
  Eye
} from "lucide-react";
import { FeedbackModal } from "./FeedbackModal";
import { useActiveAnalytics } from "./ActiveUsersWidget";

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const { activeUsers, totalVisits } = useActiveAnalytics();
  const user = session?.user;
  const isAdmin = user?.role === "ADMIN" || user?.role === "MODERATOR";
  const contributions = user?.approvedContributions || 0;

  // Cerrar el menú si se hace clic afuera del sidebar desplegado
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isOpen && 
        sidebarRef.current && 
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Cerrar el sidebar al cambiar de ruta
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      {/* ============================================================== */}
      {/* 1. Barra superior móvil (< sm) con botón para abrir el drawer  */}
      {/* ============================================================== */}
      <div className="sm:hidden fixed top-0 left-0 right-0 h-14 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-500 shadow-sm">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white text-base">
              Re<span className="text-blue-500">Pol</span>
            </span>
          </Link>
        </div>

        {/* Indicador en vivo móvil */}
        <div className="flex items-center gap-2 rounded-full bg-zinc-900/90 border border-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-white">{activeUsers}</span>
          <span className="text-zinc-400">en línea</span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. Backdrop semitransparente cuando el menú está desplegado    */}
      {/* ============================================================== */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-40 transition-opacity duration-300 animate-in fade-in"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ============================================================== */}
      {/* 3. Menú Lateral Flotante (Sidebar Desplegable encima)           */}
      {/* ============================================================== */}
      <aside
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-screen z-50 flex flex-col bg-zinc-950/95 backdrop-blur-xl border-r border-zinc-800/90 shadow-2xl transition-all duration-300 ease-in-out select-none ${
          // En móvil: oculto fuera de pantalla cuando está cerrado (-translate-x-full) y w-72 cuando abre
          // En desktop (sm+): w-[70px] cuando está cerrado, w-72 (288px) cuando se despliega encima
          isOpen 
            ? "translate-x-0 w-72 sm:w-80" 
            : "-translate-x-full sm:translate-x-0 sm:w-[70px]"
        }`}
      >
        {/* Cabecera del Sidebar: Logo + Botón Toggle */}
        <div className="h-16 flex items-center justify-between px-3.5 border-b border-zinc-800/80">
          <Link
            href="/"
            className="flex items-center gap-3 overflow-hidden group"
            title="Ir al inicio de RePol"
          >
            <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <BookOpen className="h-5 w-5 text-white" />
            </div>

            {/* Texto de la marca (visible solo al desplegar) */}
            <div className={`transition-opacity duration-200 whitespace-nowrap ${isOpen ? "opacity-100" : "opacity-0 hidden"}`}>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold tracking-tight text-white font-sans">
                  Re<span className="text-blue-500">Pol</span>
                </span>
                <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-blue-400 border border-blue-500/20">
                  Académico
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">Repositorio Universitario</p>
            </div>
          </Link>

          {/* Botón de toggle (Desplegar / Colapsar) */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition"
            title={isOpen ? "Colapsar menú (solo íconos)" : "Desplegar menú completo"}
            aria-label={isOpen ? "Colapsar menú" : "Desplegar menú"}
          >
            {isOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeftOpen className="h-5 w-5 hidden sm:block" />
            )}
          </button>
        </div>

        {/* Cuerpo del Sidebar con scroll elegante si se necesita */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-3">
          
          {/* Item 1: Inicio / Catálogo */}
          <Link
            href="/"
            className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
              pathname === "/"
                ? "bg-blue-600/15 text-blue-400 border border-blue-500/25"
                : "text-zinc-300 hover:text-white hover:bg-zinc-900/80"
            }`}
            title="Inicio / Catálogo de materias"
          >
            <div className="flex-shrink-0 flex items-center justify-center w-6">
              <Home className={`h-5 w-5 ${pathname === "/" ? "text-blue-400" : "text-zinc-400 group-hover:text-white"} transition-colors`} />
            </div>
            {isOpen && (
              <span className="whitespace-nowrap transition-opacity duration-200">
                Inicio / Catálogo
              </span>
            )}
          </Link>

          {/* Item 2: Subir Documento (Botón destacado) */}
          <Link
            href="/upload"
            className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group shadow-sm ${
              pathname === "/upload"
                ? "bg-blue-500 text-white shadow-blue-500/30"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20 active:scale-95"
            }`}
            title="Subir documento académico"
          >
            <div className="flex-shrink-0 flex items-center justify-center w-6">
              <UploadCloud className="h-5 w-5 text-white" />
            </div>
            {isOpen && (
              <div className="whitespace-nowrap overflow-hidden text-left">
                <div>Subir Documento</div>
                <div className="text-[10px] text-blue-100/80 font-normal">Aporta material a la comunidad</div>
              </div>
            )}
          </Link>

          {/* Separador sutil */}
          <div className="border-t border-zinc-800/80 my-2 mx-1" />

          {/* Item 3: Estudiantes Activos en tiempo real */}
          <div
            className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm text-zinc-300 bg-zinc-900/40 border border-zinc-900 hover:border-zinc-800 transition"
            title={`Actualmente hay ${activeUsers} estudiante${activeUsers === 1 ? "" : "s"} conectado${activeUsers === 1 ? "" : "s"} • ${totalVisits.toLocaleString("es-EC")} visitas totales`}
          >
            <div className="flex-shrink-0 flex items-center justify-center w-6">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            {isOpen && (
              <div className="whitespace-nowrap overflow-hidden text-left">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <span>{activeUsers}</span>
                  <span className="text-xs text-zinc-300 font-normal">
                    {activeUsers === 1 ? "estudiante activo" : "estudiantes activos"}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <Eye className="h-3 w-3 text-blue-400" />
                  <span>{totalVisits.toLocaleString("es-EC")} visitas registradas</span>
                </div>
              </div>
            )}
          </div>

          {/* Item 4: Nivel de Contribución (si está logueado) */}
          {user && (
            <Link
              href="/profile"
              className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm transition-all group ${
                pathname === "/profile"
                  ? "bg-zinc-900 text-white border border-zinc-700"
                  : "text-zinc-300 hover:text-white hover:bg-zinc-900/80"
              }`}
              title={`Nivel de contribución: ${contributions} documentos aportados`}
            >
              <div className="flex-shrink-0 flex items-center justify-center w-6 relative">
                <Award className={`h-5 w-5 ${contributions > 0 ? "text-amber-400" : "text-zinc-400"}`} />
                {/* Micro badge del número cuando el menú está colapsado */}
                {!isOpen && (
                  <span className="absolute -bottom-1 -right-1 flex h-4 min-w-[16px] px-0.5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white border border-zinc-950">
                    {contributions}
                  </span>
                )}
              </div>
              {isOpen && (
                <div className="whitespace-nowrap overflow-hidden flex-1 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-zinc-200">Mis Aportes</div>
                    <div className="text-[10px] text-zinc-400">Nivel de contribución</div>
                  </div>
                  <span className="font-bold text-white bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full text-xs border border-blue-500/30">
                    {contributions}
                  </span>
                </div>
              )}
            </Link>
          )}

          {/* Item 5: Panel Admin (solo si es Admin o Moderador) */}
          {isAdmin && (
            <Link
              href="/admin"
              className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group ${
                pathname === "/admin"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
              }`}
              title="Panel de Administración y Moderación Central"
            >
              <div className="flex-shrink-0 flex items-center justify-center w-6">
                <ShieldCheck className="h-5 w-5 text-amber-400" />
              </div>
              {isOpen && (
                <div className="whitespace-nowrap overflow-hidden text-left">
                  <div>Panel Admin</div>
                  <div className="text-[10px] text-amber-400/80 font-normal">Moderación central</div>
                </div>
              )}
            </Link>
          )}

          {/* Item 6: Sugerencias & Bugs */}
          <button
            onClick={() => {
              setIsOpen(false);
              setFeedbackModalOpen(true);
            }}
            className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm text-zinc-300 hover:text-white hover:bg-zinc-900/80 transition group text-left"
            title="Reportar un bug o sugerir mejoras para RePol"
          >
            <div className="flex-shrink-0 flex items-center justify-center w-6">
              <Lightbulb className="h-5 w-5 text-amber-400 group-hover:scale-110 transition-transform" />
            </div>
            {isOpen && (
              <div className="whitespace-nowrap overflow-hidden">
                <div className="font-medium text-zinc-200">Sugerencias & Bugs</div>
                <div className="text-[10px] text-zinc-400">Reporta un fallo o idea</div>
              </div>
            )}
          </button>

        </div>

        {/* ============================================================== */}
        {/* Pie del Sidebar: Usuario / Perfil / Login / Logout             */}
        {/* ============================================================== */}
        <div className="p-2 border-t border-zinc-800/80 bg-zinc-950/60">
          {user ? (
            <div className={`flex items-center gap-2 rounded-xl bg-zinc-900/90 border border-zinc-800 p-2 ${isOpen ? "justify-between" : "justify-center"}`}>
              <Link
                href="/profile"
                className="flex items-center gap-2.5 overflow-hidden group"
                title={`Ver perfil de ${user.name || user.email}`}
              >
                <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 group-hover:border-blue-500 transition">
                  <UserIcon className="h-4 w-4" />
                </div>
                {isOpen && (
                  <div className="whitespace-nowrap overflow-hidden text-left text-xs">
                    <div className="font-medium text-zinc-200 truncate max-w-[130px]">
                      {user.name || user.email}
                    </div>
                    <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                      {user.role === "ADMIN" ? (
                        <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                          <Sparkles className="h-3 w-3" /> Admin
                        </span>
                      ) : user.role === "MODERATOR" ? (
                        <span className="text-indigo-400 font-semibold flex items-center gap-0.5">
                          <ShieldCheck className="h-3 w-3" /> Mod
                        </span>
                      ) : (
                        "Estudiante"
                      )}
                    </div>
                  </div>
                )}
              </Link>

              {/* Botón de Logout */}
              {isOpen && (
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <Link
              href="/auth/signin"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 hover:border-zinc-500 text-zinc-200 hover:text-white transition font-medium text-sm ${
                isOpen ? "justify-start" : "justify-center"
              }`}
              title="Iniciar sesión institucional ESPOL"
            >
              <div className="flex-shrink-0 flex items-center justify-center w-6">
                <LogIn className="h-5 w-5 text-blue-400" />
              </div>
              {isOpen && (
                <span className="whitespace-nowrap">Ingresar a RePol</span>
              )}
            </Link>
          )}

          {/* Icono de Logout compacto cuando el menú está colapsado y el usuario logueado */}
          {!isOpen && user && (
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="mt-2 w-full flex items-center justify-center p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-zinc-900 transition"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Modal interactivo de Feedback */}
      <FeedbackModal
        isOpen={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
      />
    </>
  );
}
