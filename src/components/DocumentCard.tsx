"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { 
  Download, 
  Eye, 
  GraduationCap, 
  User, 
  Share2, 
  Paperclip,
  Trash2,
  Loader2,
  Flag,
  Edit3
} from "lucide-react";
import { formatBytes, getCategoryBadgeColor, getCategoryLabel, formatPeriodTerm, formatPeriodYear } from "@/lib/utils";
import { PdfViewerModal } from "./PdfViewerModal";
import { ReportDocumentModal } from "./ReportDocumentModal";
import { EditDocumentModal } from "./EditDocumentModal";

export interface AttachmentItem {
  name: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  storageKey?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  description?: string | null;
  fileHash: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  attachments?: AttachmentItem[] | null;
  category: "CLASE" | "LECCION" | "TALLER" | "EXAMEN" | "TAREA";
  subcategory: string;
  customDescription?: string | null;
  periodYear: number;
  periodTerm: string;
  downloadCount: number;
  createdAt: string | Date;
  subjectId?: string;
  subject: {
    id?: string;
    name: string;
    code: string;
    careers?: Array<{
      career: {
        name: string;
        code: string;
      };
    }>;
  };
  uploadedBy?: {
    name?: string | null;
    image?: string | null;
    approvedContributions?: number;
  };
}

export function DocumentCard({ 
  doc: initialDoc,
  onUpdated,
}: { 
  doc: DocumentItem;
  onUpdated?: (updatedDoc: DocumentItem) => void;
}) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const isModerator = session?.user?.role === "MODERATOR";
  const canEditOrManage = isAdmin || isModerator;

  const [doc, setDoc] = useState<DocumentItem>(initialDoc);
  const [downloads, setDownloads] = useState(initialDoc.downloadCount);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Sincronizar si cambia initialDoc externamente
  useEffect(() => {
    setDoc(initialDoc);
    setDownloads(initialDoc.downloadCount);
  }, [initialDoc]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      setDownloads((prev) => prev + 1);
      const downloadUrl = `/api/documents/download?id=${doc.id}&download=true`;
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", `${doc.title.replace(/[^a-zA-Z0-9\s._-]/g, "_")}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Error al descargar:", e);
      window.location.href = `/api/documents/download?id=${doc.id}&download=true`;
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!window.confirm(`¿Confirmas la eliminación permanente de "${doc.title}" del repositorio oficial?`)) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: doc.id }),
      });
      if (res.ok) {
        setIsDeleted(true);
        setIsViewerOpen(false);
      } else {
        const data = await res.json();
        alert(data.error || "No se pudo eliminar el documento.");
      }
    } catch (e) {
      console.error("Error al eliminar:", e);
      alert("Error de conexión al intentar eliminar el documento.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDocUpdated = (updatedDoc: DocumentItem) => {
    setDoc(updatedDoc);
    if (onUpdated) {
      onUpdated(updatedDoc);
    }
  };

  if (isDeleted) return null;

  const careersList = doc.subject.careers || [];
  const primaryCareerName = careersList.length > 0 ? careersList[0].career.name : "ESPOL";
  const extraCareersCount = careersList.length > 1 ? careersList.length - 1 : 0;

  return (
    <>
      <div className="group relative flex flex-col justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 backdrop-blur-sm transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/90 hover:shadow-xl hover:shadow-blue-500/5">
        
        {/* Cabecera de la tarjeta: Categoría y Subcategoría */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className={`rounded-lg px-2.5 py-1 text-xs font-bold border ${getCategoryBadgeColor(doc.category)}`}>
                {getCategoryLabel(doc.category)}
              </span>
              <span className="rounded-lg bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-300 border border-zinc-700">
                {doc.subcategory}
              </span>
              {doc.attachments && doc.attachments.length > 0 && (
                <span
                  className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/20"
                  title={`${doc.attachments.length} archivo(s) complementario(s) adjunto(s)`}
                >
                  <Paperclip className="h-3 w-3" />
                  <span>+{doc.attachments.length}</span>
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 font-mono bg-zinc-950/80 px-2 py-0.5 rounded-md border border-zinc-800">
              <span>{formatPeriodYear(doc.periodYear)}</span>
              <span className="text-zinc-600">•</span>
              <span className="text-blue-400 font-bold">{formatPeriodTerm(doc.periodTerm)}</span>
            </div>
          </div>

          <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2">
            {doc.title}
          </h3>

          {(doc.customDescription || doc.description) && (
            <p className="mt-2 text-xs text-zinc-400 line-clamp-2 leading-relaxed bg-zinc-950/40 p-2 rounded-lg border border-zinc-800/40">
              {doc.customDescription || doc.description}
            </p>
          )}

          {/* Información de Materia y Carreras Compartidas */}
          <div className="mt-4 flex flex-col gap-1.5 rounded-xl bg-zinc-950/60 p-3 border border-zinc-800/60">
            <div className="flex items-center gap-2 text-xs text-zinc-300 font-medium">
              <GraduationCap className="h-4 w-4 text-blue-400 shrink-0" />
              <span className="truncate">{doc.subject.name}</span>
              <span className="rounded bg-blue-500/10 px-1.5 py-0.2 text-[10px] font-mono text-blue-400 border border-blue-500/20 font-semibold shrink-0">
                {doc.subject.code}
              </span>
            </div>

            {/* Carreras que comparten esta materia */}
            <div className="text-[11px] text-zinc-400 truncate pl-6 flex items-center gap-1.5">
              <span className="truncate">{primaryCareerName}</span>
              {extraCareersCount > 0 && (
                <span
                  className="rounded-full bg-zinc-800 px-1.5 py-0.2 text-[10px] font-bold text-zinc-300 border border-zinc-700 shrink-0 flex items-center gap-0.5"
                  title={careersList.map((c) => c.career.name).join(", ")}
                >
                  <Share2 className="h-2.5 w-2.5 text-blue-400" /> +{extraCareersCount} carreras
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Pie de tarjeta: Autor, peso, y botones */}
        <div className="mt-5 pt-4 border-t border-zinc-800/80">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-3.5">
            <div className="flex items-center gap-1.5 truncate max-w-[180px]">
              <User className="h-3.5 w-3.5 text-zinc-500" />
              <span className="truncate">
                {canEditOrManage ? (doc.uploadedBy?.name || "Aporte Comunitario") : "Aporte Comunitario"}
              </span>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">{formatBytes(doc.fileSize)}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsViewerOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600/15 border border-blue-500/30 px-3 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-600 hover:text-white transition-all active:scale-98"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Ver Documento</span>
            </button>

            {/* Botón de Edición para Administradores y Moderadores */}
            {canEditOrManage && (
              <button
                onClick={() => setIsEditOpen(true)}
                className="flex items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-amber-400 hover:bg-amber-600 hover:text-white hover:border-amber-600 transition"
                title="Modificar año, período o metadatos (Admin/Moderador)"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-800/60 p-2 text-zinc-400 hover:text-white hover:border-zinc-700 transition"
              title={`Descargar (${downloads} descargas)`}
            >
              <Download className="h-4 w-4" />
            </button>

            <button
              onClick={() => setIsReportOpen(true)}
              className="flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-800/60 p-2 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10 transition"
              title="Reportar link caído, 404 o solicitar retiro"
            >
              <Flag className="h-4 w-4" />
            </button>

            {isAdmin && (
              <button
                onClick={handleDeleteDocument}
                disabled={isDeleting}
                className="flex items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition"
                title="Eliminar documento del repositorio (Solo Administrador)"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            )}

            {isModerator && (
              <button
                onClick={async () => {
                  const reason = window.prompt(`Como Moderador, justifica el motivo para dar de baja "${doc.title}":`);
                  if (!reason || reason.trim().length < 5) {
                    if (reason !== null) alert("Debes ingresar una justificación de al menos 5 caracteres.");
                    return;
                  }
                  try {
                    const res = await fetch("/api/admin/deletion-requests", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ documentId: doc.id, reason: reason.trim() }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      alert(data.message || "Solicitud de eliminación enviada al Administrador con éxito.");
                    } else {
                      alert(data.error || "Error al registrar la solicitud.");
                    }
                  } catch (e) {
                    console.error("Error al solicitar baja:", e);
                  }
                }}
                className="flex items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition"
                title="Solicitar baja de documento al Administrador (Moderador)"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de edición para Administradores y Moderadores */}
      {canEditOrManage && (
        <EditDocumentModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          document={doc}
          onUpdated={handleDocUpdated}
        />
      )}

      {/* Modal de visualización de PDF */}
      <PdfViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        document={doc}
        onDownload={() => setDownloads((prev) => prev + 1)}
      />

      {/* Modal de Reporte / Solicitud de Retiro */}
      <ReportDocumentModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        document={doc}
      />
    </>
  );
}
