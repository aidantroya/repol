"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { 
  Bug, 
  Lightbulb, 
  BookPlus, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Loader2, 
  ArrowLeft,
  Sparkles
} from "lucide-react";

const FEEDBACK_TYPES = [
  {
    id: "BUG",
    label: "Reportar un Bug / Error",
    desc: "Problema visual, descarga rota o comportamiento inesperado",
    icon: Bug,
    color: "text-rose-400 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20",
  },
  {
    id: "IMPROVEMENT_SUGGESTION",
    label: "Sugerencia de Mejora",
    desc: "Propuestas de diseño, nuevas funciones o atajos útiles",
    icon: Lightbulb,
    color: "text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20",
  },
  {
    id: "SUBJECT_REQUEST",
    label: "Materia o Carrera Faltante",
    desc: "Solicitar la creación de una asignatura o código no listado",
    icon: BookPlus,
    color: "text-blue-400 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20",
  },
  {
    id: "OTHER",
    label: "Otro Comentario",
    desc: "Mensajes generales o agradecimientos para el equipo",
    icon: MessageSquare,
    color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20",
  },
];

export default function FeedbackPage() {
  const { data: session } = useSession();
  const [type, setType] = useState<string>("BUG");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("Por favor ingresa un título o resumen.");
      return;
    }
    if (!description.trim()) {
      setErrorMsg("Por favor escribe la descripción detallada.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          email: email.trim() || session?.user?.email || "",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitted(true);
      } else {
        setErrorMsg(data.error || "No se pudo registrar el mensaje.");
      }
    } catch {
      setErrorMsg("Error de conexión al enviar el reporte.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPlaceholderByTpe = () => {
    switch (type) {
      case "BUG":
        return "Explica detalladamente qué estabas haciendo, en qué dispositivo o navegador ocurrió y el fallo observado...";
      case "IMPROVEMENT_SUGGESTION":
        return "Describe tu idea de mejora o qué herramientas te gustaría ver implementadas en RePol...";
      case "SUBJECT_REQUEST":
        return "Indica el nombre de la materia, su código institucional (ej. CCPG1043) y carrera correspondiente...";
      default:
        return "Escribe tus comentarios para el equipo...";
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      
      {/* Volver */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4 text-blue-400" />
          <span>Volver al Catálogo</span>
        </Link>
      </div>

      {/* Cabecera */}
      <div className="space-y-3 border-b border-zinc-800 pb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-400">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Comunidad & Mejora Continua</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-sans">
          Reporte de Bugs y Sugerencias de Mejora
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
          Tu retroalimentación nos ayuda a mantener RePol rápido, limpio y útil para toda la comunidad estudiantil.
        </p>
      </div>

      {submitted ? (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">¡Aporte Recibido Exitosamente!</h3>
            <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
              Muchas gracias por colaborar. El equipo de administración revisará tu mensaje y tomará las medidas oportunas.
            </p>
          </div>
          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                setSubmitted(false);
                setTitle("");
                setDescription("");
              }}
              className="rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-5 py-2.5 text-xs font-bold text-zinc-200 transition"
            >
              Enviar otro reporte
            </button>
            <Link
              href="/"
              className="rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition"
            >
              Regresar al Repositorio
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8 space-y-6 shadow-xl">
          
          {/* Tipo de reporte */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-300">
              Selecciona el tipo de aporte:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FEEDBACK_TYPES.map((item) => {
                const Icon = item.icon;
                const isSelected = type === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setType(item.id)}
                    className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition ${
                      isSelected
                        ? `${item.color} border-current ring-1 ring-current font-semibold`
                        : "border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-tight">{item.label}</p>
                      <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Asunto */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              Título o Asunto <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "BUG"
                  ? "Ejemplo: Error al filtrar por carrera en móviles..."
                  : type === "IMPROVEMENT_SUGGESTION"
                  ? "Ejemplo: Agregar modo oscuro automático o botón de favoritos..."
                  : type === "SUBJECT_REQUEST"
                  ? "Ejemplo: Solicito agregar la materia MATG1045 Álgebra Lineal..."
                  : "Breve resumen de tu mensaje..."
              }
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              Descripción y detalles <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder={getPlaceholderByTpe()}
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-3.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
            />
          </div>

          {/* Correo opcional */}
          {!session?.user?.email && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                Tu correo electrónico <span className="text-zinc-500 font-normal">(opcional para darte seguimiento)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu_correo@espol.edu.ec"
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {errorMsg && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Botón enviar */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !description.trim()}
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/20 transition active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Enviando reporte...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Enviar al Equipo</span>
                </>
              )}
            </button>
          </div>

        </form>
      )}

    </div>
  );
}
