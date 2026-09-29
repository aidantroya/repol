"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { 
  AlertTriangle, 
  X, 
  Send, 
  CheckCircle2, 
  Link2Off, 
  FileWarning, 
  ShieldAlert, 
  FileX, 
  EyeOff, 
  HelpCircle,
  Loader2
} from "lucide-react";
import { formatPeriodTerm, formatPeriodYear } from "@/lib/utils";

export interface ReportModalDoc {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  periodYear: number;
  periodTerm: string;
  subject: {
    name: string;
    code: string;
  };
}

interface ReportDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: ReportModalDoc | null;
}

const REPORT_REASONS = [
  {
    id: "BROKEN_LINK",
    label: "Link caído / No descarga",
    desc: "El enlace está roto o no permite acceder al archivo",
    icon: Link2Off,
    color: "text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20",
  },
  {
    id: "NOT_FOUND_404",
    label: "Página 404 / No encontrado",
    desc: "El servidor o Drive retorna error 404 o archivo eliminado",
    icon: FileX,
    color: "text-rose-400 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20",
  },
  {
    id: "WRONG_CONTENT",
    label: "Documento o materia incorrecta",
    desc: "El título, materia o período no coincide con el archivo",
    icon: FileWarning,
    color: "text-orange-400 border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20",
  },
  {
    id: "TAKEDOWN_REQUEST",
    label: "Solicitud de retiro / Derechos de autor",
    desc: "Soy autor/docente o titular y solicito la desindexación inmediata",
    icon: ShieldAlert,
    color: "text-red-400 border-red-500/30 bg-red-500/10 hover:bg-red-500/20",
  },
  {
    id: "LOW_QUALITY",
    label: "Baja calidad / Ilegible",
    desc: "El documento está borroso, dañado o cortado",
    icon: EyeOff,
    color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20",
  },
  {
    id: "OTHER",
    label: "Otro motivo",
    desc: "Especificar detalles personalizados",
    icon: HelpCircle,
    color: "text-blue-400 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20",
  },
];

export function ReportDocumentModal({ isOpen, onClose, document: doc }: ReportDocumentModalProps) {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (session?.user?.email) {
      setReporterEmail(session.user.email);
    }
  }, [session]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      setSelectedReason("");
      setDetails("");
      setErrorMsg("");
      setSubmitted(false);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !doc || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) {
      setErrorMsg("Por favor selecciona uno de los motivos de reporte.");
      return;
    }

    if (selectedReason === "OTHER" && !details.trim()) {
      setErrorMsg("Por favor ingresa una breve explicación de tu reporte.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: doc.id,
          reason: selectedReason,
          details: details.trim(),
          reporterEmail: reporterEmail.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitted(true);
      } else {
        setErrorMsg(data.error || "No se pudo procesar el reporte.");
      }
    } catch {
      setErrorMsg("Error de conexión al enviar el reporte.");
    } finally {
      setIsSubmitting(false);
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
              <h3 className="text-xl font-bold text-white">Reporte Registrado</h3>
              <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
                Gracias por colaborar con la integridad del repositorio. Nuestro equipo de administración revisará la solicitud y tomará la acción pertinente en un plazo máximo de 24 horas.
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Reportar o Solicitar Retiro</h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Indícanos si este documento presenta un error o requiere ser desindexado.
                </p>
              </div>
            </div>

            {/* Documento referenciado */}
            <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                {doc.subject.name} ({doc.subject.code})
              </span>
              <h4 className="text-xs font-semibold text-white truncate" title={doc.title}>
                {doc.title}
              </h4>
              <p className="text-[11px] text-zinc-400">
                {doc.subcategory} • {formatPeriodYear(doc.periodYear)} - {formatPeriodTerm(doc.periodTerm)}
              </p>
            </div>

            {/* Opciones de reporte rápido */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-300">
                Selecciona el motivo del reporte:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {REPORT_REASONS.map((reason) => {
                  const Icon = reason.icon;
                  const isSelected = selectedReason === reason.id;
                  return (
                    <button
                      key={reason.id}
                      type="button"
                      onClick={() => setSelectedReason(reason.id)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition ${
                        isSelected
                          ? `${reason.color} border-current ring-1 ring-current`
                          : "border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-800/60 text-zinc-300"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold leading-tight truncate">{reason.label}</p>
                        <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{reason.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Campo de descripción / mensaje */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                Mensaje adicional o detalles {selectedReason === "OTHER" ? <span className="text-rose-400">*</span> : <span className="text-zinc-500 font-normal">(Opcional)</span>}
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder={
                  selectedReason === "TAKEDOWN_REQUEST"
                    ? "Indica si eres el autor o docente titular para procesar el retiro inmediato..."
                    : selectedReason === "BROKEN_LINK" || selectedReason === "NOT_FOUND_404"
                    ? "Explica qué sucede al intentar acceder al enlace..."
                    : "Describe brevemente el problema detectado en el documento..."
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Correo de contacto si no está autenticado */}
            {!session?.user?.email && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300">
                  Tu correo electrónico <span className="text-zinc-500 font-normal">(opcional para dar seguimiento)</span>
                </label>
                <input
                  type="email"
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  placeholder="tu_correo@espol.edu.ec"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            {/* Botones de acción */}
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
                disabled={isSubmitting || !selectedReason}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Enviar Reporte</span>
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
