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
  Bug,
  Users,
  Activity,
  History,
  Crown,
  Search,
  RefreshCw,
  Clock,
  FileCheck,
  FileX,
  FileEdit,
  ShieldAlert,
  UserCheck,
  AlertCircle
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

interface ModeratorStats {
  approvedSubmissions: number;
  rejectedSubmissions: number;
  updatedDocuments: number;
  deletedDocuments: number;
  resolvedReports: number;
  totalActions: number;
  lastActiveAt: string | null;
}

interface ModeratorUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: "ADMIN" | "MODERATOR" | "STUDENT";
  approvedContributions: number;
  createdAt: string;
  isOwner?: boolean;
  stats: ModeratorStats;
}

interface ActivityLogItem {
  id: string;
  userId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetTitle: string | null;
  details: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    role: string;
  };
}

interface DeletionRequestItem {
  id: string;
  documentId: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  createdAt: string;
  document: {
    id: string;
    title: string;
    fileUrl: string;
    category: string;
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
  requestedBy: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    role: string;
  };
  reviewedBy?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"submissions" | "promotions" | "reports" | "feedback" | "moderators" | "deletion_requests">("submissions");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [promotions, setPromotions] = useState<PromotionRequest[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequestItem[]>([]);
  
  // Estado de Moderadores y Auditoría
  const [moderators, setModerators] = useState<ModeratorUser[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [moderatorSummary, setModeratorSummary] = useState<{
    totalStaff: number;
    totalAdmins: number;
    totalModerators: number;
    totalApproved: number;
    totalRejected: number;
    totalUpdates: number;
    totalDeletes: number;
  } | null>(null);

  const [selectedModeratorFilter, setSelectedModeratorFilter] = useState<string | null>(null);
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>("ALL");
  const [searchLogQuery, setSearchLogQuery] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal de rechazo
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>("LOW_RESOLUTION");
  const [rejectionReason, setRejectionReason] = useState("");

  const user = session?.user;
  const isAdmin = user?.role === "ADMIN" || user?.role === "MODERATOR";
  const isSuperAdmin = user?.role === "ADMIN" || user?.email === "aidtroya@espol.edu.ec";

  useEffect(() => {
    if (status === "unauthenticated" || (status === "authenticated" && !isAdmin)) {
      router.push("/");
    }
  }, [status, isAdmin, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const requests = [
        fetch("/api/admin/submissions?status=PENDING"),
        fetch("/api/admin/promotions"),
        fetch("/api/reports?status=PENDING"),
        fetch("/api/feedback?status=PENDING"),
        fetch("/api/admin/deletion-requests"),
      ];

      // Si es SuperAdmin/Admin, cargar también estadísticas de moderadores
      if (isSuperAdmin) {
        requests.push(fetch("/api/admin/moderators"));
      }

      const results = await Promise.all(requests);
      const subData = await results[0].json();
      const promData = await results[1].json();
      const repData = await results[2].json();
      const feedData = await results[3].json();
      const delReqData = await results[4].json();

      if (subData.submissions) setSubmissions(subData.submissions);
      if (promData.requests) setPromotions(promData.requests);
      if (repData.reports) setReports(repData.reports);
      if (feedData.feedbacks) setFeedbacks(feedData.feedbacks);
      if (delReqData.requests) setDeletionRequests(delReqData.requests);

      if (isSuperAdmin && results[5]) {
        const modData = await results[5].json();
        if (modData.moderators) setModerators(modData.moderators);
        if (modData.activityLogs) setActivityLogs(modData.activityLogs);
        if (modData.summary) setModeratorSummary(modData.summary);
      }
    } catch (e) {
      console.error("Error al cargar datos de admin:", e);
    } finally {
      setLoading(false);
    }
  };

  const reloadModeratorsData = async () => {
    try {
      const res = await fetch("/api/admin/moderators");
      if (res.ok) {
        const data = await res.json();
        if (data.moderators) setModerators(data.moderators);
        if (data.activityLogs) setActivityLogs(data.activityLogs);
        if (data.summary) setModeratorSummary(data.summary);
      }
    } catch (e) {
      console.error("Error reloading moderator logs:", e);
    }
  };

  const loadDeletionRequests = async () => {
    try {
      const res = await fetch("/api/admin/deletion-requests");
      if (res.ok) {
        const data = await res.json();
        if (data.requests) setDeletionRequests(data.requests);
      }
    } catch (e) {
      console.error("Error loading deletion requests:", e);
    }
  };

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
        reloadModeratorsData();
      }
    } catch (e) {
      console.error("Error al actualizar feedback:", e);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, isSuperAdmin]);

  const handleApproveDeletionRequest = async (requestId: string) => {
    if (!window.confirm("¿Confirmas la aprobación de esta solicitud? El documento será eliminado definitivamente del repositorio.")) {
      return;
    }
    setActionLoading(requestId);
    try {
      const res = await fetch("/api/admin/deletion-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: "APPROVE" }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Documento eliminado con éxito.");
        setDeletionRequests((prev) => prev.filter((d) => d.id !== requestId));
        reloadModeratorsData();
      } else {
        alert(data.error || "No se pudo aprobar la solicitud.");
      }
    } catch (e) {
      console.error("Error approving deletion request:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectDeletionRequest = async (requestId: string) => {
    const reviewNotes = window.prompt("Ingresa la razón del rechazo de esta solicitud de eliminación:") || "";
    if (reviewNotes.trim().length === 0) return;

    setActionLoading(requestId);
    try {
      const res = await fetch("/api/admin/deletion-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: "REJECT", reviewNotes: reviewNotes.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Solicitud rechazada con éxito.");
        setDeletionRequests((prev) =>
          prev.map((d) => (d.id === requestId ? { ...d, status: "REJECTED", reviewNotes: reviewNotes.trim() } : d))
        );
        reloadModeratorsData();
      } else {
        alert(data.error || "No se pudo rechazar la solicitud.");
      }
    } catch (e) {
      console.error("Error rejecting deletion request:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteReportDoc = async (reportId: string, docId: string, docTitle: string) => {
    if (isSuperAdmin) {
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
          reloadModeratorsData();
        }
      } catch (e) {
        console.error("Error al eliminar documento reportado:", e);
      } finally {
        setActionLoading(null);
      }
    } else {
      // Como MODERADOR: Enviar solicitud de eliminación con motivo
      const reason = window.prompt(
        `Como Moderador, debes justificar la eliminación de "${docTitle}" para que el Administrador la apruebe:\n\nIngresa el motivo de eliminación:`
      );
      if (!reason || reason.trim().length < 5) {
        if (reason !== null) alert("Debes ingresar un motivo de al menos 5 caracteres.");
        return;
      }

      setActionLoading(reportId);
      try {
        const reqRes = await fetch("/api/admin/deletion-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: docId, reason: reason.trim() }),
        });

        const data = await reqRes.json();
        if (reqRes.ok) {
          await fetch("/api/reports", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reportId, status: "RESOLVED", notes: `Solicitud de eliminación enviada: ${reason.trim()}` }),
          });

          setReports((prev) => prev.filter((r) => r.id !== reportId));
          alert(data.message || "Solicitud de eliminación enviada al Administrador con éxito.");
          loadDeletionRequests();
        } else {
          alert(data.error || "No se pudo registrar la solicitud.");
        }
      } catch (e) {
        console.error("Error al solicitar eliminación:", e);
      } finally {
        setActionLoading(null);
      }
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
        reloadModeratorsData();
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
        reloadModeratorsData();
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
        reloadModeratorsData();
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
        reloadModeratorsData();
      }
    } catch (e) {
      console.error("Error al actualizar promoción:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (targetUserId: string, targetName: string, newRole: "ADMIN" | "MODERATOR" | "STUDENT") => {
    if (!window.confirm(`¿Seguro que deseas cambiar el rol de ${targetName} a "${newRole}"?`)) {
      return;
    }
    setActionLoading(targetUserId);
    try {
      const res = await fetch("/api/admin/moderators", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Rol actualizado con éxito");
        reloadModeratorsData();
      } else {
        alert(data.error || "No se pudo actualizar el rol");
      }
    } catch (e) {
      console.error("Error updating role:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const formatLogDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("es-EC", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "SUBMISSION_APPROVED":
        return {
          label: "Aprobación",
          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          icon: <FileCheck className="h-3.5 w-3.5" />,
        };
      case "SUBMISSION_REJECTED":
        return {
          label: "Rechazo",
          color: "bg-rose-500/10 text-rose-400 border-rose-500/20",
          icon: <FileX className="h-3.5 w-3.5" />,
        };
      case "DOCUMENT_UPDATED":
        return {
          label: "Edición",
          color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
          icon: <FileEdit className="h-3.5 w-3.5" />,
        };
      case "DOCUMENT_DELETED":
        return {
          label: "Eliminación",
          color: "bg-red-500/15 text-red-400 border-red-500/30",
          icon: <Trash2 className="h-3.5 w-3.5" />,
        };
      case "REPORT_RESOLVED":
      case "REPORT_DISMISSED":
        return {
          label: "Reporte",
          color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
          icon: <Flag className="h-3.5 w-3.5" />,
        };
      case "PROMOTION_APPROVED":
      case "PROMOTION_REJECTED":
        return {
          label: "Ascenso",
          color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          icon: <Award className="h-3.5 w-3.5" />,
        };
      case "ROLE_UPDATED":
        return {
          label: "Gestión de Rango",
          color: "bg-orange-500/10 text-orange-400 border-orange-500/20",
          icon: <ShieldAlert className="h-3.5 w-3.5" />,
        };
      case "DELETION_REQUEST_CREATED":
        return {
          label: "Solicitud Baja",
          color: "bg-rose-500/10 text-rose-400 border-rose-500/20",
          icon: <Trash2 className="h-3.5 w-3.5" />,
        };
      case "DELETION_REQUEST_REJECTED":
        return {
          label: "Baja Denegada",
          color: "bg-zinc-800 text-zinc-400 border-zinc-700",
          icon: <FileX className="h-3.5 w-3.5" />,
        };
      case "FEEDBACK_RESOLVED":
      case "FEEDBACK_DISMISSED":
        return {
          label: "Feedback",
          color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
          icon: <Bug className="h-3.5 w-3.5" />,
        };
      default:
        return {
          label: action,
          color: "bg-zinc-800 text-zinc-300 border-zinc-700",
          icon: <Activity className="h-3.5 w-3.5" />,
        };
    }
  };

  // Filtrado de logs
  const filteredActivityLogs = activityLogs.filter((log) => {
    if (selectedModeratorFilter && log.userId !== selectedModeratorFilter) {
      return false;
    }
    if (selectedActionFilter !== "ALL") {
      if (selectedActionFilter === "APPROVALS" && log.action !== "SUBMISSION_APPROVED") return false;
      if (selectedActionFilter === "REJECTIONS" && log.action !== "SUBMISSION_REJECTED") return false;
      if (selectedActionFilter === "EDITS" && log.action !== "DOCUMENT_UPDATED") return false;
      if (selectedActionFilter === "DELETES" && log.action !== "DOCUMENT_DELETED") return false;
      if (selectedActionFilter === "REPORTS" && !log.action.startsWith("REPORT_")) return false;
    }
    if (searchLogQuery.trim()) {
      const q = searchLogQuery.toLowerCase();
      const matchTitle = log.targetTitle?.toLowerCase().includes(q);
      const matchDetails = log.details?.toLowerCase().includes(q);
      const matchUser = log.user.name?.toLowerCase().includes(q) || log.user.email.toLowerCase().includes(q);
      if (!matchTitle && !matchDetails && !matchUser) return false;
    }
    return true;
  });

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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-zinc-800 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-400 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Moderación Central RePol
            </span>
            {isSuperAdmin && (
              <span className="rounded-lg bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 text-xs font-semibold text-purple-300 flex items-center gap-1">
                <Crown className="h-3.5 w-3.5 text-amber-400" /> Vista Owner / Super Admin
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Panel de Administración</h1>
          <p className="text-sm text-zinc-400">
            Valida la calidad académica, supervisa al equipo de moderación y audita la actividad en tiempo real.
          </p>
        </div>

        {/* Pestañas de Navegación */}
        <div className="flex flex-wrap rounded-xl bg-zinc-900 p-1 border border-zinc-800 gap-1">
          <button
            onClick={() => setActiveTab("submissions")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${
              activeTab === "submissions"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>Cola Documentos</span>
            <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[11px] font-bold text-blue-300">
              {submissions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("promotions")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${
              activeTab === "promotions"
                ? "bg-amber-600 text-white shadow-md shadow-amber-500/20"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>Ascensos</span>
            <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[11px] font-bold text-amber-300">
              {promotions.filter((p) => p.status === "PENDING").length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("reports")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${
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

          {/* Pestaña: Solicitudes de Eliminación */}
          <button
            onClick={() => setActiveTab("deletion_requests")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${
              activeTab === "deletion_requests"
                ? "bg-red-700 text-white shadow-md shadow-red-700/25"
                : "text-red-300 hover:text-white hover:bg-zinc-800/60"
            }`}
            title="Solicitudes de eliminación de documentos enviadas por Moderadores"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-400" />
            <span>Bajas / Solicitudes</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${deletionRequests.filter(d => d.status === "PENDING").length > 0 ? "bg-red-500 text-white" : "bg-zinc-950 text-zinc-400"}`}>
              {deletionRequests.filter(d => d.status === "PENDING").length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("feedback")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${
              activeTab === "feedback"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Bug className="h-3.5 w-3.5" />
            <span>Feedback</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${feedbacks.length > 0 ? "bg-indigo-500 text-white" : "bg-zinc-950 text-zinc-400"}`}>
              {feedbacks.length}
            </span>
          </button>

          {/* Pestaña Exclusiva para Owner / Super Admin */}
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab("moderators")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${
                activeTab === "moderators"
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25"
                  : "text-purple-300 hover:text-white hover:bg-zinc-800/60"
              }`}
              title="Supervisión de Moderadores y Registro de Auditoría"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Moderadores & Auditoría</span>
              <span className="rounded-full bg-purple-950/80 border border-purple-500/30 px-2 py-0.5 text-[11px] font-bold text-purple-200">
                {moderators.length}
              </span>
            </button>
          )}
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
                    </div>

                    {/* Info del Estudiante */}
                    <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3 text-xs text-zinc-400">
                      <div className="flex items-center gap-1.5 truncate max-w-[240px]">
                        <span className="text-zinc-200 font-medium truncate">{sub.user.name || sub.user.email}</span>
                        <span className="text-zinc-500 font-mono text-[11px] truncate">({sub.user.email})</span>
                      </div>
                      <span className="text-[11px] text-zinc-500 shrink-0 font-mono">
                        {new Date(sub.createdAt).toLocaleDateString("es-EC", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-800/60">
                    <a
                      href={sub.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 transition"
                    >
                      <Eye className="h-3.5 w-3.5 text-blue-400" />
                      <span>Previsualizar</span>
                    </a>

                    <button
                      onClick={() => {
                        setSelectedSubId(sub.id);
                        setSelectedPreset("LOW_RESOLUTION");
                        setRejectionReason(REJECTION_PRESETS[0].desc);
                        setRejectModalOpen(true);
                      }}
                      disabled={actionLoading === sub.id}
                      className="flex items-center justify-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-400 transition disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Rechazar</span>
                    </button>

                    <button
                      onClick={() => handleApproveSubmission(sub.id)}
                      disabled={actionLoading === sub.id}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-emerald-500/20 transition disabled:opacity-50 active:scale-95"
                    >
                      {actionLoading === sub.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      <span>Aprobar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pestaña 2: Solicitudes de Ascenso */}
      {activeTab === "promotions" && (
        <div className="space-y-4">
          {promotions.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
              <Award className="mx-auto h-12 w-12 text-zinc-600 mb-3" />
              <h3 className="text-lg font-semibold text-white">No hay solicitudes de ascenso</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Cuando los estudiantes alcancen 10 aportes y soliciten ser moderadores, aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {promotions.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-bold text-white">{p.user.name || "Estudiante ESPOL"}</h4>
                        <p className="text-xs text-zinc-400">{p.user.email}</p>
                      </div>
                      <span className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-400 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> {p.user.approvedContributions} aportes
                      </span>
                    </div>

                    <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800/80 text-xs text-zinc-300 mb-4">
                      <span className="font-semibold text-zinc-400 block mb-1">Motivación del estudiante:</span>
                      &quot;{p.reason || "Deseo contribuir moderando material académico de mi facultad."}&quot;
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60">
                    <button
                      onClick={() => handlePromotionAction(p.id, "REJECT")}
                      disabled={actionLoading === p.id}
                      className="flex-1 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 py-2 text-xs font-semibold text-rose-400 transition"
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => handlePromotionAction(p.id, "APPROVE")}
                      disabled={actionLoading === p.id}
                      className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 py-2 text-xs font-bold text-white shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-1"
                    >
                      {actionLoading === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Award className="h-3.5 w-3.5" />
                      )}
                      <span>Ascender a Moderador</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pestaña 3: Reportes de Documentos */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
              <Flag className="mx-auto h-12 w-12 text-zinc-600 mb-3" />
              <h3 className="text-lg font-semibold text-white">No hay reportes pendientes</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Todos los avisos de la comunidad sobre links caídos o inconsistencias están al día.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-400">
                        {rep.reason}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {new Date(rep.createdAt).toLocaleDateString("es-EC", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white mb-1">{rep.document.title}</h4>
                    <p className="text-xs text-zinc-400 mb-2 font-mono">
                      {rep.document.subject.name} ({rep.document.subject.code})
                    </p>

                    {rep.details && (
                      <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800 text-xs text-zinc-300 mb-4">
                        <span className="text-zinc-500 block mb-1">Detalles del reporte:</span>
                        {rep.details}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60">
                    <button
                      onClick={() => handleDismissReport(rep.id)}
                      disabled={actionLoading === rep.id}
                      className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 py-2 text-xs font-semibold text-zinc-300 transition"
                    >
                      Descartar
                    </button>
                    <button
                      onClick={() => handleDeleteReportDoc(rep.id, rep.documentId, rep.document.title)}
                      disabled={actionLoading === rep.id}
                      className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 py-2 text-xs font-bold text-white shadow-md shadow-rose-500/20 transition flex items-center justify-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Retirar Documento</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pestaña 4: Feedback de la Comunidad */}
      {activeTab === "feedback" && (
        <div className="space-y-4">
          {feedbacks.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
              <Bug className="mx-auto h-12 w-12 text-zinc-600 mb-3" />
              <h3 className="text-lg font-semibold text-white">No hay feedback pendiente</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Todas las sugerencias y reportes de error han sido atendidos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {feedbacks.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
                        {item.type}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {new Date(item.createdAt).toLocaleDateString("es-EC", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {item.user && (
                        <span className="text-xs text-zinc-400">
                          Por: <span className="text-zinc-200 font-medium">{item.user.name || item.user.email}</span>
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-white">{item.title}</h3>
                    <p className="text-xs sm:text-sm text-zinc-300 whitespace-pre-line bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
                      {item.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
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
                      <Check className="h-3.5 w-3.5" />
                      <span>Marcar Resuelto</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pestaña: Solicitudes de Eliminación de Documentos */}
      {activeTab === "deletion_requests" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-red-400" />
                <span>Solicitudes de Eliminación de Documentos</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isSuperAdmin
                  ? "Los moderadores solicitan la baja de documentos con justificación. Solo el Administrador principal puede aprobar la eliminación definitiva."
                  : "Historial de solicitudes de baja de documentos enviadas para la revisión del Administrador principal."}
              </p>
            </div>
            <button
              onClick={loadDeletionRequests}
              className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Actualizar</span>
            </button>
          </div>

          {deletionRequests.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
              <Trash2 className="mx-auto h-12 w-12 text-zinc-600 mb-3" />
              <h3 className="text-lg font-semibold text-white">No hay solicitudes de eliminación</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Cuando los moderadores soliciten dar de baja algún documento del repositorio, aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {deletionRequests.map((req) => (
                <div
                  key={req.id}
                  className={`rounded-2xl border p-5 flex flex-col justify-between transition ${
                    req.status === "PENDING"
                      ? "border-red-500/30 bg-zinc-900/80 shadow-lg"
                      : "border-zinc-800 bg-zinc-900/40 opacity-80"
                  }`}
                >
                  <div>
                    {/* Header de la Solicitud */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${
                          req.status === "PENDING"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : req.status === "APPROVED"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {req.status === "PENDING"
                          ? "⏳ Pendiente de Aprobación Admin"
                          : req.status === "APPROVED"
                          ? "✓ Eliminación Aprobada"
                          : "✕ Solicitud Rechazada"}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {new Date(req.createdAt).toLocaleDateString("es-EC", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Información del Documento */}
                    <div className="mb-3">
                      <h4 className="text-sm font-bold text-white mb-1">{req.document?.title || "Documento"}</h4>
                      {req.document?.subject && (
                        <p className="text-xs text-zinc-400 font-mono">
                          {req.document.subject.name} ({req.document.subject.code})
                        </p>
                      )}
                    </div>

                    {/* Justificación del Moderador */}
                    <div className="rounded-xl bg-zinc-950 p-3 border border-red-500/20 text-xs text-zinc-200 mb-3 space-y-1">
                      <span className="text-red-400 font-semibold block flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" /> Motivo / Justificación del Moderador:
                      </span>
                      <p className="leading-relaxed whitespace-pre-line">{req.reason}</p>
                    </div>

                    {/* Notas del Administrador si ya fue revisado */}
                    {req.reviewNotes && (
                      <div className="rounded-xl bg-zinc-950 p-3 border border-zinc-800 text-xs text-zinc-300 mb-3">
                        <span className="text-zinc-400 font-semibold block mb-0.5">Nota de resolución del Admin:</span>
                        <p>{req.reviewNotes}</p>
                      </div>
                    )}

                    {/* Info de quién solicitó */}
                    <div className="flex items-center justify-between border-t border-zinc-800/80 pt-2.5 text-xs text-zinc-400">
                      <div>
                        <span className="truncate max-w-[200px]">
                          Solicitado por: <strong className="text-zinc-300">{req.requestedBy?.name || req.requestedBy?.email}</strong>
                        </span>
                      </div>
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                        {req.requestedBy?.role}
                      </span>
                    </div>
                  </div>

                  {/* Acciones de Administrador (Solo si está PENDING y es Admin) */}
                  {req.status === "PENDING" && isSuperAdmin && (
                    <div className="flex items-center gap-2 pt-3 mt-3 border-t border-zinc-800/60">
                      {req.document?.fileUrl && (
                        <a
                          href={req.document.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 transition"
                          title="Previsualizar el documento antes de decidir"
                        >
                          <Eye className="h-3.5 w-3.5 text-blue-400" />
                          <span className="hidden sm:inline">Ver Doc</span>
                        </a>
                      )}

                      <button
                        onClick={() => handleRejectDeletionRequest(req.id)}
                        disabled={actionLoading === req.id}
                        className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 py-2 text-xs font-semibold text-zinc-300 transition"
                      >
                        Rechazar Solicitud
                      </button>

                      <button
                        onClick={() => handleApproveDeletionRequest(req.id)}
                        disabled={actionLoading === req.id}
                        className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 py-2 text-xs font-bold text-white shadow-md shadow-red-600/25 transition flex items-center justify-center gap-1 active:scale-95"
                      >
                        {actionLoading === req.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        <span>Aprobar y Eliminar</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pestaña 5: Supervisión de Moderadores & Auditoría (Owner / Super Admin) */}
      {activeTab === "moderators" && isSuperAdmin && (
        <div className="space-y-8 animate-in fade-in duration-200">
          
          {/* Métricas Globales del Equipo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-950/40 to-zinc-900 p-5 shadow-lg">
              <div className="flex items-center justify-between text-purple-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Equipo Total</span>
                <Users className="h-4 w-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white">
                {moderatorSummary?.totalStaff || moderators.length}
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">
                {moderatorSummary?.totalAdmins || 0} Admins • {moderatorSummary?.totalModerators || 0} Moderadores
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-zinc-900 p-5 shadow-lg">
              <div className="flex items-center justify-between text-emerald-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Aprobaciones</span>
                <FileCheck className="h-4 w-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white">
                {moderatorSummary?.totalApproved || 0}
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">Documentos verificados y publicados</div>
            </div>

            <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-950/40 to-zinc-900 p-5 shadow-lg">
              <div className="flex items-center justify-between text-rose-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Rechazos</span>
                <FileX className="h-4 w-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white">
                {moderatorSummary?.totalRejected || 0}
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">Material filtrado por no calidad</div>
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/40 to-zinc-900 p-5 shadow-lg">
              <div className="flex items-center justify-between text-blue-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Ediciones</span>
                <FileEdit className="h-4 w-4" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white">
                {moderatorSummary?.totalUpdates || 0}
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">Correcciones de metadatos</div>
            </div>
          </div>

          {/* Sección 1: Directorio de Moderadores y Administradores */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-purple-400" />
                  <span>Directorio de Moderadores y Permisos</span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Visualiza el rendimiento de cada miembro y gestiona sus roles.
                </p>
              </div>
              <button
                onClick={reloadModeratorsData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition"
              >
                <RefreshCw className="h-3.5 w-3.5 text-purple-400" />
                <span>Actualizar</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {moderators.map((mod) => {
                const isCurrentFilter = selectedModeratorFilter === mod.id;
                return (
                  <div
                    key={mod.id}
                    className={`rounded-2xl border p-5 transition flex flex-col justify-between ${
                      isCurrentFilter
                        ? "border-purple-500 bg-purple-950/20 shadow-xl shadow-purple-900/20 ring-1 ring-purple-500"
                        : "border-zinc-800 bg-zinc-900/80 hover:border-zinc-700"
                    }`}
                  >
                    <div>
                      {/* Cabecera del Moderador */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-white truncate" title={mod.name || mod.email}>
                              {mod.name || "Usuario ESPOL"}
                            </h3>
                            {mod.isOwner && (
                              <span title="Administrador Principal">
                                <Crown className="h-4 w-4 text-amber-400 shrink-0" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 truncate" title={mod.email}>
                            {mod.email}
                          </p>
                        </div>

                        <span
                          className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider shrink-0 border ${
                            mod.role === "ADMIN"
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {mod.role === "ADMIN" ? "ADMIN" : "MODERATOR"}
                        </span>
                      </div>

                      {/* Resumen de Acciones del Moderador */}
                      <div className="grid grid-cols-2 gap-2 my-3 text-xs bg-zinc-950/80 p-3 rounded-xl border border-zinc-800/80">
                        <div className="flex items-center justify-between text-zinc-300">
                          <span className="text-zinc-500">Aprobaciones:</span>
                          <span className="font-bold text-emerald-400">{mod.stats.approvedSubmissions}</span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-300">
                          <span className="text-zinc-500">Rechazos:</span>
                          <span className="font-bold text-rose-400">{mod.stats.rejectedSubmissions}</span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-300">
                          <span className="text-zinc-500">Ediciones:</span>
                          <span className="font-bold text-blue-400">{mod.stats.updatedDocuments}</span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-300">
                          <span className="text-zinc-500">Reportes:</span>
                          <span className="font-bold text-purple-400">{mod.stats.resolvedReports}</span>
                        </div>
                      </div>

                      {/* Última actividad */}
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-3">
                        <Clock className="h-3 w-3 text-zinc-500" />
                        <span>
                          {mod.stats.lastActiveAt
                            ? `Activo: ${formatLogDate(mod.stats.lastActiveAt)}`
                            : "Sin actividad registrada aún"}
                        </span>
                      </div>
                    </div>

                    {/* Botones de acción del Moderador */}
                    <div className="flex items-center gap-2 pt-3 border-t border-zinc-800/60">
                      <button
                        onClick={() => {
                          if (selectedModeratorFilter === mod.id) {
                            setSelectedModeratorFilter(null);
                          } else {
                            setSelectedModeratorFilter(mod.id);
                          }
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-1.5 px-2.5 text-xs font-semibold transition ${
                          isCurrentFilter
                            ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                            : "border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                        }`}
                      >
                        <Activity className="h-3.5 w-3.5" />
                        <span>{isCurrentFilter ? "Filtrando" : "Ver Actividad"}</span>
                      </button>

                      {/* Selector de Rango (Solo para no-owners) */}
                      {!mod.isOwner ? (
                        <select
                          value={mod.role}
                          onChange={(e) =>
                            handleRoleChange(mod.id, mod.name || mod.email, e.target.value as "MODERATOR" | "STUDENT")
                          }
                          disabled={actionLoading === mod.id}
                          className="rounded-xl border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs font-semibold text-zinc-300 focus:outline-none focus:border-purple-500 cursor-pointer"
                          title="Cambiar rol del usuario"
                        >
                          <option value="MODERATOR">Moderador</option>
                          <option value="STUDENT">Degradar a Estudiante</option>
                        </select>
                      ) : (
                        <span className="text-[11px] text-purple-300 font-semibold px-2 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                          Admin Único
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sección 2: Registro en Vivo de Auditoría (Audit Trail) */}
          <div className="space-y-4 pt-4 border-t border-zinc-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <History className="h-5 w-5 text-indigo-400" />
                  <span>Historial de Auditoría en Tiempo Real</span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Registro cronológico detallado de aprobaciones, rechazos, ediciones y borrados realizados por el staff.
                </p>
              </div>

              {/* Filtro activo indicador */}
              {selectedModeratorFilter && (
                <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 px-3 py-1 rounded-xl text-xs text-purple-300">
                  <span>Filtrando por moderador</span>
                  <button
                    onClick={() => setSelectedModeratorFilter(null)}
                    className="hover:text-white font-bold p-0.5 rounded-full hover:bg-purple-500/30"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Barra de Búsqueda y Filtros de Acción */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Buscador */}
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Buscar en auditoría por documento, materia, moderador o motivo..."
                  value={searchLogQuery}
                  onChange={(e) => setSearchLogQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Filtro de Tipo de Acción */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                {[
                  { id: "ALL", label: "Todos" },
                  { id: "APPROVALS", label: "Aprobaciones" },
                  { id: "REJECTIONS", label: "Rechazos" },
                  { id: "EDITS", label: "Ediciones" },
                  { id: "DELETES", label: "Eliminaciones" },
                  { id: "REPORTS", label: "Reportes" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedActionFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                      selectedActionFilter === f.id
                        ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                        : "border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Listado de Eventos de Auditoría */}
            {filteredActivityLogs.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-10 text-center">
                <History className="mx-auto h-10 w-10 text-zinc-600 mb-2" />
                <h3 className="text-base font-semibold text-white">No se encontraron registros de auditoría</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Ajusta los filtros o realiza nuevas acciones de moderación para visualizarlas aquí.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredActivityLogs.map((log) => {
                  const badge = getActionBadge(log.action);
                  return (
                    <div
                      key={log.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 hover:bg-zinc-900 hover:border-zinc-700 transition"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        {/* Icono de Acción */}
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl border shrink-0 mt-0.5 ${badge.color}`}
                        >
                          {badge.icon}
                        </div>

                        {/* Contenido del Log */}
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.color}`}>
                              {badge.label}
                            </span>
                            <span className="text-xs font-semibold text-white">
                              {log.user.name || log.user.email}
                            </span>
                            <span className="text-[11px] text-zinc-500 font-mono">
                              ({log.user.email})
                            </span>
                          </div>

                          <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                            {log.details || log.targetTitle || "Acción registrada"}
                          </p>

                          {log.metadata && typeof log.metadata === "object" && (log.metadata.rejectionReason || log.metadata.subjectCode) && (
                            <div className="text-[11px] text-zinc-400 bg-zinc-950/70 p-2 rounded-lg border border-zinc-800/80 font-mono">
                              {log.metadata.rejectionReason && (
                                <div><span className="text-rose-400 font-semibold">Motivo:</span> {log.metadata.rejectionReason}</div>
                              )}
                              {log.metadata.subjectCode && (
                                <div><span className="text-blue-400 font-semibold">Materia:</span> {log.metadata.subjectCode}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="flex items-center gap-1 text-[11px] text-zinc-500 shrink-0 self-end sm:self-center font-mono">
                        <Clock className="h-3 w-3" />
                        <span>{formatLogDate(log.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
