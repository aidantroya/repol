"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { 
  Bug, 
  Lightbulb, 
  BookPlus, 
  MessageSquare, 
  X, 
  Send, 
  CheckCircle2, 
  Loader2, 
  Sparkles
} from "lucide-react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: "BUG" | "IMPROVEMENT_SUGGESTION" | "SUBJECT_REQUEST" | "OTHER";
}

const FEEDBACK_TYPES = [
  {
    id: "BUG",
    label: "Reportar un Bug / Error",
    desc: "Problema visual, descarga fallida o fallo en la web",
    icon: Bug,
    color: "text-rose-400 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20",
  },
  {
    id: "IMPROVEMENT_SUGGESTION",
    label: "Sugerencia de Mejora",
    desc: "Ideas para nuevas funciones o diseño de RePol",
    icon: Lightbulb,
    color: "text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20",
  },
  {
    id: "SUBJECT_REQUEST",
    label: "Materia o Carrera Faltante",
    desc: "Solicitar la adición de una materia o carrera",
    icon: BookPlus,
    color: "text-blue-400 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20",
  },
  {
    id: "OTHER",
    label: "Otro Comentario",
    desc: "Mensaje o retroalimentación general",
    icon: MessageSquare,
    color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20",
  },
];

export function FeedbackModal({ isOpen, onClose, defaultType = "BUG" }: FeedbackModalProps) {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [type, setType] = useState<string>(defaultType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (session?.user?.email) {
      setEmail(session.user.email);
    }
  }, [session]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      setType(defaultType);
      setTitle("");
      setDescription("");
      setErrorMsg("");
      setSubmitted(false);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, defaultType, onClose]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("Por favor ingresa un título o resumen del reporte.");
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
          email: email.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitted(true);
      } else {
        setErrorMsg(data.error || "No se pudo enviar el reporte.");
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
        return "Explica qué estabas haciendo cuando ocurrió el error, en qué página o botón, y qué mensaje apareció...";
      case "IMPROVEMENT_SUGGESTION":
        return "Cuéntanos qué te gustaría que tuviera RePol o cómo podemos hacer la plataforma más cómoda para estudiar...";
      case "SUBJECT_REQUEST":
        return "Indica el nombre de la materia, el código oficial (ej. CCPG1043) y la carrera o facultad a la que pertenece...";
      default:
        return "Escribe tus comentarios o sugerencias para el equipo de desarrollo...";
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8 shadow-2xl space-y-6">
        
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
        >
          <X className="h-5 w-5" />
        </button>

        {submitted ? (
          <div className="py-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">¡Aporte Recibido!</h3>
              <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
                Muchas gracias por ayudarnos a mejorar RePol. El equipo revisará tu sugerencia / reporte para seguir perfeccionando la experiencia de todos los estudiantes.
              </p>
            </div>
            <div className="pt-4">
              <button
                onClick={onClose}
                className="w-full sm:w-auto rounded-xl bg-zinc-800 hover:bg-zinc-700 px-6 py-2.5 text-xs font-bold text-white transition shadow-sm"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Encabezado */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Bugs, Sugerencias y Mejoras</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  ¿Encontraste un fallo técnico o tienes una idea para mejorar RePol? Cuéntanos a continuación.
                </p>
              </div>
            </div>

            {/* Selector de Tipo */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-300">
                Tipo de reporte o sugerencia:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FEEDBACK_TYPES.map((item) => {
                  const Icon = item.icon;
                  const isSelected = type === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setType(item.id)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition ${
                        isSelected
                          ? `${item.color} border-current ring-1 ring-current font-semibold`
                          : "border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-800/60 text-zinc-300"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold leading-tight">{item.label}</p>
                        <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{item.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Asunto / Título */}
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
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Descripción detallada */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                Descripción detallada <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder={getPlaceholderByTpe()}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
              />
            </div>

            {/* Correo de contacto */}
            {!session?.user?.email && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300">
                  Tu correo electrónico <span className="text-zinc-500 font-normal">(opcional para darte respuesta)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu_correo@espol.edu.ec"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            {/* Botones */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim() || !description.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Enviar Aporte</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
