"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  ShieldCheck, 
  Check, 
  X, 
  Loader2, 
  Eye, 
  GraduationCap, 
  Award,
  Sparkles,
  Paperclip,
  Flag,
  Trash2,
  ExternalLink,
  Bug,
  Lightbulb,
  BookPlus,
  MessageSquare
} from "lucide-react";
import { getCategoryBadgeColor, getCategoryLabel, formatPeriodYear, formatPeriodTerm } from "@/lib/utils";

interface FeedbackItem {
  id: string;
  type: "BUG" | "IMPROVEMENT_SUGGESTION" | "SUBJECT_REQUEST" | "OTHER";
  title: string;
  description: string;
  email?: string | null;
  status: "PENDING" | "REVIEWED" | "RESOLVED" | "DISMISSED";
  adminNotes?: string | null;
  createdAt: string;
  user?: {
    id: string;
    name?: string | null;
    email: string;
    role: string;
  } | null;
}

const REJECTION_PRESETS = [
  {
    id: "LOW_RESOLUTION",
    label: "Baja resolución / Ilegible",
    desc: "El escaneo o las fotos están borrosas o no se leen con claridad.",
  },
  {
    id: "INCOMPLETE",
    label: "Incompleto o cortado",
    desc: "Faltan páginas, preguntas o partes esenciales del documento.",
  },
  {
    id: "WRONG_SUBJECT",
    label: "Materia / Código incorrecto",
    desc: "El contenido no corresponde a la asignatura o código seleccionado.",
  },
  {
    id: "WRONG_TERM",
    label: "Período / Término incorrecto",
    desc: "El año o término académico (1PAO/2PAO) no coincide con la fecha del material.",
  },
  {
    id: "DUPLICATE",
    label: "Documento duplicado",
    desc: "Este material ya se encuentra publicado en el catálogo oficial.",
  },
  {
    id: "OTHER",
    label: "Otro motivo (Personalizado)",
    desc: "Escribe un motivo personalizado a continuación.",
  },
];

interface ReportItem {
  id: string;
  documentId: string;
  reason: "BROKEN_LINK" | "NOT_FOUND_404" | "WRONG_CONTENT" | "TAKEDOWN_REQUEST" | "LOW_QUALITY" | "OTHER";
  details?: string | null;
  reporterEmail?: string | null;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  document: {
    id: string;
    title: string;
    fileUrl: string;
    category: "CLASE" | "LECCION" | "TALLER" | "EXAMEN" | "TAREA";
    subcategory: string;
    periodYear: number;
    periodTerm: string;
    subject: {
      name: string;
      code: string;
    };
    uploadedBy?: {
      name?: string | null;
      email?: string | null;
    };
  };
  user?: {
    name?: string | null;
    email?: string | null;
  };
}

interface Submission {
  id: string;
  title: string;
  description?: string | null;
  fileHash: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  attachments?: Array<{ name: string; fileUrl: string; fileSize?: number; mimeType?: string }> | null;
  category: "CLASE" | "LECCION" | "TALLER" | "EXAMEN" | "TAREA";
  subcategory: string;
  customDescription?: string | null;
  periodYear: number;
  periodTerm: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  createdAt: string;
  subject: {
    name: string;
    code: string;
    career?: {
      name: string;
    };
    careers?: Array<{
      career: {
        name: string;
      };
    }>;
  };
  user: {
    id: string;
    name: string;
    email: string;
    approvedContributions: number;
    image?: string;
  };
}

interface PromotionRequest {
  id: string;
  userId: string;
  reason?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    approvedContributions: number;
    image?: string;
  };
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"submissions" | "promotions" | "reports" | "feedback">("submissions");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [promotions, setPromotions] = useState<PromotionRequest[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal de rechazo
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>("LOW_RESOLUTION");
  const [rejectionReason, setRejectionReason] = useState("");

  const user = session?.user;
  const isAdmin = user?.role === "ADMIN" || user?.role === "MODERATOR";

  useEffect(() => {
    if (status === "unauthenticated" || (status === "authenticated" && !isAdmin)) {
      router.push("/");
    }
  }, [status, isAdmin, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [subRes, promRes, repRes, feedRes] = await Promise.all([
        fetch("/api/admin/submissions?status=PENDING"),
        fetch("/api/admin/promotions"),
        fetch("/api/reports?status=PENDING"),
        fetch("/api/feedback?status=PENDING"),
      ]);

      const subData = await subRes.json();
      const promData = await promRes.json();
      const repData = await repRes.json();
      const feedData = await feedRes.json();

      if (subData.submissions) setSubmissions(subData.submissions);
      if (promData.requests) setPromotions(promData.requests);
      if (repData.reports) setReports(repData.reports);
      if (feedData.feedbacks) setFeedbacks(feedData.feedbacks);
    } catch (e) {
      console.error("Error al cargar datos de admin:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const handleFeedbackStatus = async (feedbackId: string, newStatus: "RESOLVED" | "DISMISSED") => {
    setActionLoading(feedbackId);
    try {
      const res = await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId, status: newStatus }),
      });
      if (res.ok) {
        setFeedbacks((prev) => prev.filter((f) => f.id !== feedbackId));
      }
    } catch (e) {
      console.error("Error al actualizar feedback:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteReportDoc = async (reportId: string, docId: string, docTitle: string) => {
    if (!window.confirm(`¿Confirmas la eliminación definitiva de "${docTitle}" y resolución del reporte?`)) {
      return;
    }
    setActionLoading(reportId);
    try {
      const delRes = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: docId }),
      });

      await fetch("/api/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, status: "RESOLVED" }),
      });

      if (delRes.ok) {
        setReports((prev) => prev.filter((r) => r.id !== reportId));
      }
    } catch (e) {
      console.error("Error al eliminar documento reportado:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismissReport = async (reportId: string) => {
    setActionLoading(reportId);
    try {
      const res = await fetch("/api/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, status: "DISMISSED" }),
      });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== reportId));
      }
    } catch (e) {
      console.error("Error al descartar reporte:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveSubmission = async (submissionId: string) => {
    setActionLoading(submissionId);
    try {
      const res = await fetch("/api/admin/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          action: "APPROVE",
        }),
      });

      if (res.ok) {
        setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      }
    } catch (e) {
      console.error("Error al aprobar:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!selectedSubId) return;
    setActionLoading(selectedSubId);
    try {
      const res = await fetch("/api/admin/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: selectedSubId,
          action: "REJECT",
          rejectionReason,
        }),
      });

      if (res.ok) {
        setSubmissions((prev) => prev.filter((s) => s.id !== selectedSubId));
        setRejectModalOpen(false);
        setSelectedSubId(null);
        setRejectionReason("");
      }
    } catch (e) {
      console.error("Error al rechazar:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePromotionAction = async (requestId: string, action: "APPROVE" | "REJECT") => {
    setActionLoading(requestId);
    try {
      const res = await fetch("/api/admin/promotions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });

      if (res.ok) {
        setPromotions((prev) => prev.filter((p) => p.id !== requestId));
      }
    } catch (e) {
      console.error("Error al actualizar promoción:", e);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      
      {/* Encabezado del Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-400 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Moderación Central
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Panel de Administración</h1>
          <p className="text-sm text-zinc-400">
            Valida la calidad del material académico y gestiona las promociones de rango.
          </p>
        </div>

        {/* Pestañas */}
        <div className="flex rounded-xl bg-zinc-900 p-1 border border-zinc-800">
          <button
            onClick={() => setActiveTab("submissions")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition ${
              activeTab === "submissions"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>Cola de Documentos</span>
            <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[11px] font-bold text-blue-300">
              {submissions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("promotions")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition ${
              activeTab === "promotions"
                ? "bg-amber-600 text-white shadow-md shadow-amber-500/20"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>Ascensos a Admin</span>
            <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[11px] font-bold text-amber-300">
              {promotions.filter((p) => p.status === "PENDING").length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("reports")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition ${
              activeTab === "reports"
                ? "bg-rose-600 text-white shadow-md shadow-rose-500/20"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Flag className="h-3.5 w-3.5" />
            <span>Reportes</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${reports.length > 0 ? "bg-rose-500 text-white" : "bg-zinc-950 text-zinc-400"}`}>
              {reports.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("feedback")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition ${
              activeTab === "feedback"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Bug className="h-3.5 w-3.5" />
            <span>Bugs & Sugerencias</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${feedbacks.length > 0 ? "bg-indigo-500 text-white" : "bg-zinc-950 text-zinc-400"}`}>
              {feedbacks.length}
            </span>
          </button>
        </div>
      </div>

      {/* Pestaña 1: Cola de Documentos Pendientes */}
      {activeTab === "submissions" && (
        <div>
          {submissions.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-400 mb-4">
                <Check className="h-7 w-7 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">¡No hay documentos pendientes!</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Todas las solicitudes de la comunidad universitaria han sido revisadas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg backdrop-blur-sm"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${getCategoryBadgeColor(
                            sub.category
                          )}`}
                        >
                          {getCategoryLabel(sub.category)}
                        </span>
                        <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-300">
                          {sub.subcategory}
                        </span>
                        {sub.attachments && sub.attachments.length > 0 && (
                          <span
                            className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/20"
                            title={`${sub.attachments.length} archivo(s) complementario(s) adjunto(s)`}
                          >
                            <Paperclip className="h-3 w-3" />
                            <span>+{sub.attachments.length} anexos</span>
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400 font-mono">
                        {formatPeriodYear(sub.periodYear)} - {formatPeriodTerm(sub.periodTerm)}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white mb-1.5">{sub.title}</h3>

                    {(sub.customDescription || sub.description) && (
                      <p className="text-xs text-zinc-300 mb-3 bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/80">
                        {sub.customDescription || sub.description}
                      </p>
                    )}

                    {/* Metadatos de Materia */}
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mb-3">
                      <GraduationCap className="h-4 w-4 text-blue-400 shrink-0" />
                      <span className="font-semibold text-zinc-300">{sub.subject.name}</span>
                      <span className="font-mono text-blue-400">({sub.subject.code})</span>
                      <span>• {sub.subject.career?.name || sub.subject.careers?.[0]?.career.name || "ESPOL"}</span>
                    </div>

                    {/* Info del Estudiante que subió */}
                    <div className="flex items-center justify-between text-xs bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-zinc-400">Enviado por:</span>
                        <span className="font-medium text-white truncate">{sub.user.name || sub.user.email}</span>
                      </div>
                      <span className="text-amber-400 font-semibold shrink-0">
                        {sub.user.approvedContributions} aprobados
                      </span>
                    </div>
                  </div>

                  {/* Acciones de Moderación */}
                  <div className="mt-5 pt-4 border-t border-zinc-800 flex items-center gap-2">
                    <a
                      href={sub.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Ver Archivo</span>
                    </a>

                    <button
                      onClick={() => handleApproveSubmission(sub.id)}
                      disabled={actionLoading === sub.id}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                    >
                      {actionLoading === sub.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      <span>Aprobar y Publicar</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedSubId(sub.id);
                        setSelectedPreset("LOW_RESOLUTION");
                        setRejectionReason(REJECTION_PRESETS[0].desc);
                        setRejectModalOpen(true);
                      }}
                      disabled={actionLoading === sub.id}
                      className="flex items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-400 transition"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Rechazar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pestaña 2: Solicitudes de Rango de Administrador */}
      {activeTab === "promotions" && (
        <div className="space-y-4">
          {promotions.filter((p) => p.status === "PENDING").length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
              <Award className="h-10 w-10 text-zinc-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white">Sin solicitudes de ascenso pendientes</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Los estudiantes con 10 o más documentos aprobados podrán solicitar el rango de Administrador aquí.
              </p>
            </div>
          ) : (
            promotions
              .filter((p) => p.status === "PENDING")
              .map((prom) => (
                <div
                  key={prom.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 backdrop-blur-sm"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                      <Award className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base">{prom.user.name || "Estudiante"}</span>
                        <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                          {prom.user.approvedContributions} Documentos Aprobados
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">{prom.user.email}</div>
                      {prom.reason && (
                        <p className="text-xs text-zinc-300 mt-2 bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                          &quot;{prom.reason}&quot;
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => handlePromotionAction(prom.id, "APPROVE")}
                      disabled={actionLoading === prom.id}
                      className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-zinc-950 shadow-md shadow-amber-500/20 transition"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Conceder Rol Admin</span>
                    </button>
                    <button
                      onClick={() => handlePromotionAction(prom.id, "REJECT")}
                      disabled={actionLoading === prom.id}
                      className="rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 transition"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* Pestaña 3: Reportes de Documentos & Solicitudes de Retiro */}
      {activeTab === "reports" && (
        <div>
          {reports.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-400 mb-4">
                <Check className="h-7 w-7 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">¡No hay reportes pendientes!</h3>
              <p className="text-sm text-zinc-400 mt-1">
                No existen incidencias ni solicitudes de retiro sin procesar en este momento.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((rep) => {
                const getReasonBadge = (reason: string) => {
                  switch (reason) {
                    case "BROKEN_LINK":
                      return { text: "Link Caído", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
                    case "NOT_FOUND_404":
                      return { text: "Error 404", cls: "bg-rose-500/10 text-rose-400 border-rose-500/30" };
                    case "WRONG_CONTENT":
                      return { text: "Contenido Incorrecto", cls: "bg-orange-500/10 text-orange-400 border-orange-500/30" };
                    case "TAKEDOWN_REQUEST":
                      return { text: "Solicitud de Retiro / Takedown", cls: "bg-red-500/20 text-red-300 border-red-500/40" };
                    case "LOW_QUALITY":
                      return { text: "Baja Calidad", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" };
                    default:
                      return { text: "Otro Motivo", cls: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
                  }
                };

                const badge = getReasonBadge(rep.reason);

                return (
                  <div
                    key={rep.id}
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg backdrop-blur-sm transition hover:border-zinc-700"
                  >
                    <div className="space-y-2.5 flex-1 min-w-0">
                      {/* Cabecera del reporte */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-lg border px-2.5 py-0.5 text-xs font-bold ${badge.cls}`}>
                          {badge.text}
                        </span>
                        <span className="text-xs text-zinc-500 font-mono">
                          {new Date(rep.createdAt).toLocaleDateString("es-EC", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {rep.reporterEmail && (
                          <span className="text-xs text-zinc-400">
                            Por: <span className="text-zinc-200 font-medium">{rep.reporterEmail}</span>
                          </span>
                        )}
                      </div>

                      {/* Detalles del documento afectado */}
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-medium text-blue-400">
                          <GraduationCap className="h-3.5 w-3.5" />
                          <span>{rep.document.subject.name} ({rep.document.subject.code})</span>
                          <span className="text-zinc-600">•</span>
                          <span className="text-zinc-400">{rep.document.subcategory} ({formatPeriodYear(rep.document.periodYear)}-{formatPeriodTerm(rep.document.periodTerm)})</span>
                        </div>
                        <h4 className="text-sm font-bold text-white truncate" title={rep.document.title}>
                          {rep.document.title}
                        </h4>
                      </div>

                      {/* Mensaje o motivo detallado */}
                      {rep.details && (
                        <div className="text-xs text-zinc-300 bg-zinc-950/50 p-2.5 rounded-xl border border-zinc-800/80">
                          <span className="font-semibold text-zinc-400">Detalles del reporte: </span>
                          <span className="italic text-zinc-200">&quot;{rep.details}&quot;</span>
                        </div>
                      )}
                    </div>

                    {/* Botones de acción para administradores */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
                      <a
                        href={rep.document.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white transition"
                        title="Abrir enlace del documento para verificar error"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Ver Archivo</span>
                      </a>

                      <button
                        onClick={() => handleDismissReport(rep.id)}
                        disabled={actionLoading === rep.id}
                        className="rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 transition"
                        title="Descartar reporte si el documento no presenta problemas"
                      >
                        Descartar
                      </button>

                      <button
                        onClick={() => handleDeleteReportDoc(rep.id, rep.document.id, rep.document.title)}
                        disabled={actionLoading === rep.id}
                        className="flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition active:scale-95"
                        title="Eliminar documento del repositorio y resolver reporte"
                      >
                        {actionLoading === rep.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        <span>Eliminar Doc & Resolver</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pestaña 4: Bugs, Sugerencias de Mejora y Solicitudes de Materias */}
      {activeTab === "feedback" && (
        <div>
          {feedbacks.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-400 mb-4">
                <Check className="h-7 w-7 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">¡No hay sugerencias ni bugs pendientes!</h3>
              <p className="text-sm text-zinc-400 mt-1">
                La comunidad universitaria no ha registrado nuevos reportes técnicos o propuestas sin atender.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedbacks.map((item) => {
                const getTypeBadge = (type: string) => {
                  switch (type) {
                    case "BUG":
                      return { text: "Bug / Error", cls: "bg-rose-500/10 text-rose-400 border-rose-500/30", icon: Bug };
                    case "IMPROVEMENT_SUGGESTION":
                      return { text: "Sugerencia de Mejora", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30", icon: Lightbulb };
                    case "SUBJECT_REQUEST":
                      return { text: "Materia Faltante", cls: "bg-blue-500/10 text-blue-400 border-blue-500/30", icon: BookPlus };
                    default:
                      return { text: "Otro Comentario", cls: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30", icon: MessageSquare };
                  }
                };

                const badge = getTypeBadge(item.type);
                const BadgeIcon = badge.icon;

                return (
                  <div
                    key={item.id}
                    className="flex flex-col lg:flex-row lg:items-start justify-between gap-5 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg backdrop-blur-sm transition hover:border-zinc-700"
                  >
                    <div className="space-y-3 flex-1 min-w-0">
                      {/* Tipo y fecha */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-bold ${badge.cls}`}>
                          <BadgeIcon className="h-3.5 w-3.5" />
                          <span>{badge.text}</span>
                        </span>
                        <span className="text-xs text-zinc-500 font-mono">
                          {new Date(item.createdAt).toLocaleDateString("es-EC", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {(item.user || item.email) && (
                          <span className="text-xs text-zinc-400">
                            Por: <span className="text-zinc-200 font-medium">{item.user?.name || item.user?.email || item.email}</span>
                          </span>
                        )}
                      </div>

                      {/* Título */}
                      <h3 className="text-base font-bold text-white">
                        {item.title}
                      </h3>

                      {/* Descripción */}
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 text-xs sm:text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                        {item.description}
                      </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
                      <button
                        onClick={() => handleFeedbackStatus(item.id, "DISMISSED")}
                        disabled={actionLoading === item.id}
                        className="rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-300 transition"
                      >
                        Descartar
                      </button>

                      <button
                        onClick={() => handleFeedbackStatus(item.id, "RESOLVED")}
                        disabled={actionLoading === item.id}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition active:scale-95"
                      >
                        {actionLoading === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        <span>Marcar Resuelto</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Motivo de Rechazo con Opciones por Defecto y Mensaje Personalizado */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-7 shadow-2xl space-y-5">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <X className="h-4 w-4" />
                </span>
                <span>Motivo del Rechazo</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Selecciona una razón predefinida o escribe una indicación detallada para notificar al estudiante.
              </p>
            </div>

            {/* Opciones por Defecto (Presets) */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-300">
                Seleccionar motivo común:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {REJECTION_PRESETS.map((preset) => {
                  const isSelected = selectedPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setSelectedPreset(preset.id);
                        if (preset.id === "OTHER") {
                          setRejectionReason("");
                        } else {
                          setRejectionReason(preset.desc);
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left transition text-xs ${
                        isSelected
                          ? "border-rose-500/60 bg-rose-500/10 text-white ring-1 ring-rose-500/40 font-semibold"
                          : "border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      <div className="font-bold">{preset.label}</div>
                      {preset.id !== "OTHER" && (
                        <div className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{preset.desc}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Campo de Texto Personalizado / Editable */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                Detalle del mensaje al usuario {selectedPreset === "OTHER" ? <span className="text-rose-400">* (Obligatorio)</span> : <span className="text-zinc-500 font-normal">(Editable)</span>}:
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={
                  selectedPreset === "OTHER"
                    ? "Explica detalladamente por qué no se puede aceptar este documento..."
                    : "Puedes ajustar este texto si deseas añadir detalles específicos..."
                }
                rows={3}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={!rejectionReason.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition active:scale-95"
              >
                <X className="h-3.5 w-3.5" />
                <span>Confirmar Rechazo</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
