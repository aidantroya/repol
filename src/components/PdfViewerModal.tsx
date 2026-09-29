"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, FileText, Paperclip, ChevronDown, ChevronUp, FileCode, ArrowLeft, Flag } from "lucide-react";
import { formatBytes, getCategoryBadgeColor, getCategoryLabel, formatPeriodTerm, formatPeriodYear } from "@/lib/utils";
import { ReportDocumentModal } from "./ReportDocumentModal";

export interface AttachmentItem {
  name: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    id: string;
    title: string;
    description?: string | null;
    customDescription?: string | null;
    fileUrl: string;
    fileSize: number;
    attachments?: AttachmentItem[] | null;
    category: "CLASE" | "LECCION" | "TALLER" | "EXAMEN";
    subcategory: string;
    periodYear: number;
    periodTerm: string;
    subject: {
      name: string;
      code: string;
      career?: {
        name: string;
      };
      careers?: Array<{
        career: {
          name: string;
          code: string;
        };
      }>;
    };
  } | null;
  onDownload?: () => void;
}

export function PdfViewerModal({ isOpen, onClose, document: doc, onDownload }: PdfViewerModalProps) {
  const [showAttachments, setShowAttachments] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !doc || !mounted) return null;

  const hasAttachments = Boolean(doc.attachments && doc.attachments.length > 0);

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex h-screen w-screen flex-col bg-zinc-950 animate-in fade-in duration-150 select-none">
      
      {/* Barra superior de controles a pantalla completa */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/95 px-4 sm:px-6 z-20">
        <div className="flex items-center gap-3 truncate mr-4">
          
          {/* Botón de Volver al Catálogo */}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-600 px-3.5 py-1.5 text-xs font-bold text-white transition shrink-0 shadow-sm active:scale-95"
            title="Volver al catálogo (Esc)"
          >
            <ArrowLeft className="h-4 w-4 text-blue-400" />
            <span>Volver</span>
          </button>

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
            <FileText className="h-4 w-4" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${getCategoryBadgeColor(
                  doc.category
                )}`}
              >
                {getCategoryLabel(doc.category)}
              </span>
              <span className="text-xs font-semibold text-zinc-300 truncate">
                {doc.subcategory} • {formatPeriodYear(doc.periodYear)} - {formatPeriodTerm(doc.periodTerm)}
              </span>
              {hasAttachments && (
                <span className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20">
                  <Paperclip className="h-3 w-3" />
                  <span>+{doc.attachments?.length} anexos</span>
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-white truncate max-w-md sm:max-w-xl md:max-w-2xl">
              {doc.title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Botón para ver anexos si existen */}
          {hasAttachments && (
            <button
              onClick={() => setShowAttachments(!showAttachments)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium border transition ${
                showAttachments
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                  : "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200"
              }`}
            >
              <Paperclip className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline">Anexos ({doc.attachments?.length})</span>
              {showAttachments ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}

          {/* Botón de Descarga directa del PDF principal */}
          <button
            onClick={() => {
              if (onDownload) onDownload();
              window.open(doc.fileUrl, "_blank");
            }}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition"
            title="Descargar PDF principal a tu dispositivo"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Descargar</span>
            <span className="text-[10px] opacity-80">({formatBytes(doc.fileSize)})</span>
          </button>

          {/* Abrir en pestaña nueva */}
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 p-2 text-zinc-300 hover:text-white transition"
            title="Abrir PDF en pestaña nueva"
          >
            <ExternalLink className="h-4 w-4" />
          </a>

          {/* Botón de reporte rápido */}
          <button
            onClick={() => setIsReportOpen(true)}
            className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 p-2 text-zinc-400 transition"
            title="Reportar error, link caído o solicitar retiro"
          >
            <Flag className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Panel desplegable de archivos complementarios / anexos */}
      {hasAttachments && showAttachments && (
        <div className="border-b border-zinc-800 bg-zinc-900/95 p-3 sm:px-6 animate-in slide-in-from-top-2 duration-150 z-20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" />
              Archivos complementarios y material adicional del documento:
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {doc.attachments?.map((att, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition"
              >
                <div className="flex items-center gap-2 truncate">
                  <FileCode className="h-4 w-4 text-amber-400 shrink-0" />
                  <div className="truncate">
                    <p className="text-xs font-medium text-zinc-200 truncate" title={att.name}>
                      {att.name}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {formatBytes(att.fileSize || 0)}
                    </p>
                  </div>
                </div>

                <a
                  href={att.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-medium border border-zinc-700 shrink-0 transition"
                >
                  <Download className="h-3 w-3 text-amber-400" />
                  <span>Bajar</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visor Embebido de PDF / Google Drive (Ocupa 100% de la pantalla) */}
      <div className="relative flex-1 w-full h-full bg-zinc-950 overflow-hidden">
        <iframe
          src={
            doc.fileUrl.includes("drive.google.com")
              ? doc.fileUrl
              : `${doc.fileUrl}#toolbar=1&navpanes=0&scrollbar=1`
          }
          className="h-full w-full border-0 bg-zinc-950"
          title={doc.title}
          allow="autoplay"
        />
      </div>

      {/* Barra inferior compacta con metadatos del documento */}
      <div className="flex h-9 shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-900/90 px-4 sm:px-6 text-xs text-zinc-400 z-20">
        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold text-zinc-200">{doc.subject.name}</span>
          <span className="text-zinc-500">({doc.subject.code})</span>
          <span className="text-zinc-600">•</span>
          <span className="truncate text-zinc-400">
            {doc.subject.career?.name || doc.subject.careers?.[0]?.career.name || "ESPOL"}
          </span>
        </div>

        {(doc.customDescription || doc.description) && (
          <div className="text-[11px] text-zinc-400 italic truncate max-w-md hidden md:block">
            &quot;{doc.customDescription || doc.description}&quot;
          </div>
        )}
      </div>

      {/* Modal de Reporte */}
      <ReportDocumentModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        document={doc}
      />

    </div>
  );

  return createPortal(modalContent, document.body);
}
