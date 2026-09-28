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
  ExternalLink
} from "lucide-react";
import { getCategoryBadgeColor, getCategoryLabel } from "@/lib/utils";

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
    category: "CLASE" | "LECCION" | "TALLER" | "EXAMEN";
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
  category: "CLASE" | "LECCION" | "TALLER" | "EXAMEN";
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

  const [activeTab, setActiveTab] = useState<"submissions" | "promotions" | "reports">("submissions");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [promotions, setPromotions] = useState<PromotionRequest[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal de rechazo
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
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
      const [subRes, promRes, repRes] = await Promise.all([
        fetch("/api/admin/submissions?status=PENDING"),
        fetch("/api/admin/promotions"),
        fetch("/api/reports?status=PENDING"),
      ]);

      const subData = await subRes.json();
      const promData = await promRes.json();
      const repData = await repRes.json();

      if (subData.submissions) setSubmissions(subData.submissions);
      if (promData.requests) setPromotions(promData.requests);
      if (repData.reports) setReports(repData.reports);
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
                        {sub.periodYear} - {sub.periodTerm}
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
                          <span className="text-zinc-400">{rep.document.subcategory} ({rep.document.periodYear}-{rep.document.periodTerm})</span>
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

      {/* Modal de Motivo de Rechazo */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Motivo del Rechazo</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Indica al estudiante por qué este documento no fue aprobado (ej. resolución borrosa, contenido incompleto, materia equivocada):
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ejemplo: Las fotos de la lección están cortadas o no se aprecia el desarrollo del ejercicio 3..."
              rows={4}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={!rejectionReason.trim()}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
