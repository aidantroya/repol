"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  X, 
  Edit3, 
  Loader2, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  Calendar,
  Layers,
  BookOpen,
  FileText,
  Link as LinkIcon,
  Paperclip,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
  CheckSquare,
  Square
} from "lucide-react";
import { DocumentItem, AttachmentItem } from "./DocumentCard";
import { SearchableSelect, SearchableOption } from "./SearchableSelect";
import { formatPeriodTerm } from "@/lib/utils";
import { generateCleanDocumentTitle, detectIsSolution, extractOriginalFileName } from "@/lib/metadata-detector";

interface EditDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentItem;
  onUpdated?: (updatedDoc: DocumentItem) => void;
}

export function EditDocumentModal({
  isOpen,
  onClose,
  document: initialDoc,
  onUpdated,
}: EditDocumentModalProps) {
  const [mounted, setMounted] = useState(false);

  const [title, setTitle] = useState(initialDoc.title);
  const [fileUrl, setFileUrl] = useState(initialDoc.fileUrl || "");
  const [category, setCategory] = useState<"EXAMEN" | "LECCION" | "TALLER" | "CLASE" | "TAREA">(initialDoc.category);
  const [subcategory, setSubcategory] = useState(initialDoc.subcategory);
  const [customSubcategory, setCustomSubcategory] = useState("");
  const [customDescription, setCustomDescription] = useState(initialDoc.customDescription || "");
  const [periodYear, setPeriodYear] = useState<number>(
    typeof initialDoc.periodYear === "number" ? initialDoc.periodYear : (parseInt(String(initialDoc.periodYear), 10) || 0)
  );
  const [periodTerm, setPeriodTerm] = useState<string>(formatPeriodTerm(initialDoc.periodTerm) || "1PAO");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    initialDoc.subjectId || initialDoc.subject?.id || ""
  );
  const [isSolution, setIsSolution] = useState<boolean>(false);

  // Anexos
  const [attachments, setAttachments] = useState<AttachmentItem[]>(
    Array.isArray(initialDoc.attachments) ? initialDoc.attachments : []
  );
  const [newAttName, setNewAttName] = useState("");
  const [newAttUrl, setNewAttUrl] = useState("");
  const [showAddAttachment, setShowAddAttachment] = useState(false);

  const [subjectOptions, setSubjectOptions] = useState<SearchableOption[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Función para resolver el ID exacto de la materia sin falsos positivos por nombres duplicados
  const resolveSubjectId = (options: SearchableOption[], doc: DocumentItem): string => {
    const directId = doc.subjectId || doc.subject?.id;
    if (directId && options.some((o) => o.value === directId)) {
      return directId;
    }

    const targetCode = doc.subject?.code?.trim().toUpperCase();
    if (targetCode) {
      const byCode = options.find((o) => o.badge?.trim().toUpperCase() === targetCode);
      if (byCode) return byCode.value;
    }

    const targetName = doc.subject?.name?.trim().toLowerCase();
    if (targetName) {
      const byName = options.find((o) => o.label.trim().toLowerCase() === targetName);
      if (byName) return byName.value;
    }

    return directId || "";
  };

  // Cargar lista de materias
  useEffect(() => {
    async function loadSubjects() {
      if (!isOpen) return;
      setLoadingSubjects(true);
      try {
        const res = await fetch("/api/careers");
        const data = await res.json();
        if (data.careers) {
          const map = new Map<string, SearchableOption>();
          for (const car of data.careers) {
            for (const sub of car.subjects) {
              if (!map.has(sub.id)) {
                map.set(sub.id, {
                  value: sub.id,
                  label: sub.name,
                  badge: sub.code,
                });
              }
            }
          }
          const options = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
          setSubjectOptions(options);

          // Resolver con prioridad exacta de ID -> Código -> Nombre
          const resolved = resolveSubjectId(options, initialDoc);
          if (resolved) {
            setSelectedSubjectId(resolved);
          }
        }
      } catch (e) {
        console.error("Error al cargar materias para edición:", e);
      } finally {
        setLoadingSubjects(false);
      }
    }
    loadSubjects();
  }, [isOpen, initialDoc]);

  // Sincronizar estado cuando cambia el documento o se abre el modal
  useEffect(() => {
    if (isOpen) {
      setTitle(initialDoc.title);
      setFileUrl(initialDoc.fileUrl || "");
      setCategory(initialDoc.category);
      setSubcategory(initialDoc.subcategory);
      setCustomDescription(initialDoc.customDescription || "");
      const parsedInitialYear = typeof initialDoc.periodYear === "number" 
        ? initialDoc.periodYear 
        : (parseInt(String(initialDoc.periodYear), 10) || 0);
      setPeriodYear(parsedInitialYear);
      setPeriodTerm(formatPeriodTerm(initialDoc.periodTerm) || "1PAO");
      setSelectedSubjectId(initialDoc.subjectId || initialDoc.subject?.id || "");
      const initialIsSol = detectIsSolution(initialDoc.title);
      setIsSolution(initialIsSol);
      setAttachments(Array.isArray(initialDoc.attachments) ? [...initialDoc.attachments] : []);
      setShowAddAttachment(false);
      setNewAttName("");
      setNewAttUrl("");
      setErrorMessage("");
      setSuccessMessage("");
    }
  }, [isOpen, initialDoc]);

  const subcategoryOptions: Record<"EXAMEN" | "LECCION" | "TALLER" | "CLASE" | "TAREA", string[]> = {
    EXAMEN: ["Parcial", "Final", "Mejoramiento", "Otro"],
    LECCION: ["Lección 1", "Lección 2", "Lección 3", "Lección 4", "Otro"],
    TALLER: ["Taller 1", "Taller 2", "Taller 3", "Taller 4", "Otro"],
    TAREA: ["Tareas", "Ejercicios Extras", "Guía de Problemas", "Otro"],
    CLASE: ["Apuntes de Clase", "Diapositivas", "Guía Teórica", "Otro"],
  };

  const currentSubcategories = subcategoryOptions[category] || ["General", "Otro"];
  const currentYear = new Date().getFullYear();
  const baseYears = Array.from({ length: 20 }, (_, i) => currentYear - i + 1);
  const years = Array.from(new Set([
    ...baseYears,
    ...(typeof periodYear === "number" && periodYear > 0 ? [periodYear] : []),
    ...(typeof initialDoc.periodYear === "number" && initialDoc.periodYear > 0 ? [initialDoc.periodYear] : [])
  ])).sort((a, b) => b - a);

  // Extraer el nombre original a partir del storageKey, título o datos del documento
  const getOriginalName = (): string => {
    if (initialDoc.storageKey) {
      const fromKey = extractOriginalFileName(initialDoc.storageKey);
      if (fromKey) return fromKey;
    }
    if (initialDoc.title) {
      const isExam = /^examen\s+(?:parcial|final|mejoramiento)/i.test(initialDoc.title.trim());
      if (!isExam) {
        return initialDoc.title.replace(/\s*\(soluci[oó]n\)$/i, "").trim();
      }
    }
    if (initialDoc.customDescription && initialDoc.customDescription.trim().length <= 80) {
      const isExam = /^examen\s+(?:parcial|final|mejoramiento)/i.test(initialDoc.customDescription.trim());
      if (!isExam) {
        return initialDoc.customDescription.trim();
      }
    }
    return "";
  };

  const autoUpdateTitle = (
    newCat: "EXAMEN" | "LECCION" | "TALLER" | "CLASE" | "TAREA",
    newSubcat: string,
    newYear: number,
    newTerm: string,
    newIsSol: boolean = isSolution
  ) => {
    const origName = getOriginalName();

    if (
      (newCat === "EXAMEN" || newCat === "LECCION" || newCat === "TALLER") &&
      newSubcat !== "Otro"
    ) {
      const generated = generateCleanDocumentTitle({
        category: newCat,
        subcategory: newSubcat,
        periodYear: newYear > 0 ? String(newYear) : "S/F",
        periodTerm: newTerm,
        isSolution: newIsSol,
        originalFilename: origName || initialDoc.title,
      });
      setTitle(generated);
    } else {
      // Para CLASE, TAREA o subcategoría personalizada (actividades que conservan su nombre original):
      // Si el documento fue clasificado como examen por error y se regresa a clase/apuntes, se recupera el nombre original.
      const solSuffix = newIsSol ? " (Solución)" : "";
      if (origName) {
        setTitle(`${origName}${solSuffix}`);
      } else {
        const clean = title.replace(/\s*\(soluci[oó]n\)$/i, "").trim();
        const isGenericExam = /^examen\s+(?:parcial|final|mejoramiento)/i.test(clean);
        if (isGenericExam) {
          setTitle(`${newSubcat || "Documento"}${solSuffix}`);
        } else {
          setTitle(`${clean}${solSuffix}`);
        }
      }
    }
  };

  const handleToggleSolution = () => {
    const nextSol = !isSolution;
    setIsSolution(nextSol);
    autoUpdateTitle(category, subcategory, periodYear, periodTerm, nextSol);
  };

  const handleAddAttachment = () => {
    if (!newAttName.trim() || !newAttUrl.trim()) {
      alert("Por favor ingresa tanto el nombre como el enlace del archivo adjunto.");
      return;
    }

    const newItem: AttachmentItem = {
      name: newAttName.trim(),
      fileUrl: newAttUrl.trim(),
      fileSize: 1024 * 100, // estimado por defecto si es link
      mimeType: newAttUrl.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
    };

    setAttachments((prev) => [...prev, newItem]);
    setNewAttName("");
    setNewAttUrl("");
    setShowAddAttachment(false);
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage("El título del documento es obligatorio.");
      return;
    }

    if (!fileUrl.trim()) {
      setErrorMessage("El enlace o URL del documento es obligatorio.");
      return;
    }

    const finalSubcategory = subcategory === "Otro" ? (customSubcategory.trim() || "Otro") : subcategory;

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await fetch("/api/documents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: initialDoc.id,
          title: title.trim(),
          fileUrl: fileUrl.trim(),
          category,
          subcategory: finalSubcategory,
          customDescription: customDescription.trim() || null,
          periodYear,
          periodTerm,
          subjectId: selectedSubjectId || undefined,
          attachments: attachments.length > 0 ? attachments : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el documento.");
      }

      setSuccessMessage("¡Documento actualizado correctamente!");
      if (onUpdated && data.document) {
        onUpdated(data.document);
      }
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error al guardar los cambios.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900 text-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Cabecera */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Modificar Documento</h2>
              <p className="text-xs text-zinc-400">
                Panel de Moderación: Edita período, enlaces, archivos adjuntos y metadatos.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cuerpo del formulario con Scroll */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
          
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <form id="edit-doc-form" onSubmit={handleSave} className="space-y-5">
            
            {/* Título con botón para estandarizar */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-blue-400" />
                  Título del Documento *
                </span>
                <button
                  type="button"
                  onClick={() => {
                    autoUpdateTitle(category, subcategory, periodYear, periodTerm, isSolution);
                  }}
                  className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium transition"
                  title="Regenerar título adecuado para la categoría seleccionada"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>
                    {category === "CLASE" || category === "TAREA" ? "Restaurar nombre original" : "Estandarizar título"}
                  </span>
                </button>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Primer Examen Parcial 2024"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                required
              />
            </div>

            {/* Enlace / Link del Archivo Principal */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5 text-blue-400" />
                  Enlace de Visualización / Descarga Principal *
                </span>
                {fileUrl && (
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                  >
                    <span>Probar enlace</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </label>
              <input
                type="text"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/... o enlace R2"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 font-mono text-xs placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                required
              />
            </div>

            {/* Materia Asociada */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-blue-400" />
                Materia de la ESPOL
              </label>
              {loadingSubjects ? (
                <div className="flex items-center gap-2 text-xs text-zinc-400 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  <span>Cargando catálogo de materias...</span>
                </div>
              ) : (
                <SearchableSelect
                  options={subjectOptions}
                  value={selectedSubjectId}
                  onChange={(val) => setSelectedSubjectId(val)}
                  placeholder="Seleccionar materia..."
                  searchPlaceholder="Escribe el nombre o código (ej. CCPG1043)..."
                />
              )}
            </div>

            {/* Año Evaluado y Período Académico (1PAO, 2PAO, PAE) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Año */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-blue-400" />
                  Año Evaluado *
                </label>
                <select
                  value={periodYear}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    const newYear = isNaN(val) ? 0 : val;
                    setPeriodYear(newYear);
                    autoUpdateTitle(category, subcategory, newYear, periodTerm, isSolution);
                  }}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value={0}>S/F (Sin fecha / No especificado)</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Período Académico (Estrictamente 1PAO, 2PAO, PAE) */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-blue-400" />
                  Período Académico *
                </label>
                <select
                  value={periodTerm}
                  onChange={(e) => {
                    const newTerm = e.target.value;
                    setPeriodTerm(newTerm);
                    autoUpdateTitle(category, subcategory, periodYear, newTerm, isSolution);
                  }}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="1PAO">1PAO (Primer PAO)</option>
                  <option value="2PAO">2PAO (Segundo PAO)</option>
                  <option value="PAE">PAE (Periodo Extraordinario)</option>
                </select>
              </div>

            </div>

            {/* Categoría y Subcategoría */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Categoría */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Categoría *
                </label>
                <select
                  value={category}
                  onChange={(e) => {
                    const newCat = e.target.value as "EXAMEN" | "LECCION" | "TALLER" | "CLASE" | "TAREA";
                    const newSubcat = subcategoryOptions[newCat]?.[0] || "General";
                    setCategory(newCat);
                    setSubcategory(newSubcat);
                    autoUpdateTitle(newCat, newSubcat, periodYear, periodTerm, isSolution);
                  }}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="EXAMEN">Exámenes</option>
                  <option value="LECCION">Lecciones</option>
                  <option value="TALLER">Talleres</option>
                  <option value="CLASE">Clases y Apuntes</option>
                  <option value="TAREA">Material de Entrenamiento</option>
                </select>
              </div>

              {/* Subcategoría */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Subcategoría *
                </label>
                <select
                  value={subcategory}
                  onChange={(e) => {
                    const newSubcat = e.target.value;
                    setSubcategory(newSubcat);
                    autoUpdateTitle(category, newSubcat, periodYear, periodTerm, isSolution);
                  }}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
                >
                  {currentSubcategories.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Opción / Botón Interactivo de Solución */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-zinc-200 block">¿Contiene Solución / Respuestas?</span>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Indica si este documento incluye solucionario, rúbrica o preguntas resueltas.
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleSolution}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition shadow-sm shrink-0 active:scale-95 ${
                  isSolution
                    ? "border-teal-500/50 bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 shadow-teal-500/10"
                    : "border-zinc-700/80 bg-zinc-800/80 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                }`}
                title="Haz clic para marcar o desmarcar si incluye solución"
              >
                {isSolution ? (
                  <>
                    <CheckSquare className="h-4 w-4 text-teal-400" />
                    <span>Incluye Solución ✓</span>
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 text-zinc-500" />
                    <span>Sin Solución</span>
                  </>
                )}
              </button>
            </div>

            {subcategory === "Otro" && (
              <div className="animate-in fade-in duration-150">
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Especificar Subcategoría Personalizada:
                </label>
                <input
                  type="text"
                  value={customSubcategory}
                  onChange={(e) => setCustomSubcategory(e.target.value)}
                  placeholder="Ej. Control de Lectura 1"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}

            {/* SECCIÓN DE ARCHIVOS ADJUNTOS / ANEXOS */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">Archivos y Enlaces Adjuntos</span>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.2 text-[10px] font-semibold text-zinc-300 border border-zinc-700">
                    {attachments.length}
                  </span>
                </div>

                {!showAddAttachment && (
                  <button
                    type="button"
                    onClick={() => setShowAddAttachment(true)}
                    className="flex items-center gap-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-xs font-semibold text-blue-400 hover:text-white transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Añadir adjunto</span>
                  </button>
                )}
              </div>

              {/* Formulario rápido para añadir anexo */}
              {showAddAttachment && (
                <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-300">Nuevo Archivo / Enlace Adjunto:</span>
                    <button
                      type="button"
                      onClick={() => setShowAddAttachment(false)}
                      className="text-zinc-400 hover:text-white text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newAttName}
                      onChange={(e) => setNewAttName(e.target.value)}
                      placeholder="Nombre del anexo (ej. Solucionario, Dataset)"
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={newAttUrl}
                      onChange={(e) => setNewAttUrl(e.target.value)}
                      placeholder="Enlace URL (Drive, R2, web)"
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none font-mono text-[11px]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAttachment}
                    className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-bold text-white transition"
                  >
                    Guardar Anexo
                  </button>
                </div>
              )}

              {/* Lista de adjuntos existentes */}
              {attachments.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-1">
                  No hay archivos adjuntos complementarios en este documento.
                </p>
              ) : (
                <div className="space-y-2">
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/90 p-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <Paperclip className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span className="font-semibold text-zinc-200 truncate">{att.name}</span>
                        <a
                          href={att.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-blue-400 hover:text-blue-300 font-mono truncate max-w-[200px]"
                          title={att.fileUrl}
                        >
                          {att.fileUrl}
                        </a>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={att.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                          title="Abrir anexo"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(idx)}
                          className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition"
                          title="Eliminar anexo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Descripción opcional */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Descripción o Detalles Adicionales (Opcional)
              </label>
              <textarea
                rows={2}
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Información sobre temas evaluados, docente o soluciones incluidas..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none resize-none"
              />
            </div>

          </form>

        </div>

        {/* Barra de Acciones Fija al Pie */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-zinc-800 bg-zinc-950/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
          >
            Cancelar
          </button>

          <button
            form="edit-doc-form"
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Guardando cambios...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Guardar Cambios</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
