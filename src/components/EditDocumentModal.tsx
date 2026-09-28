"use client";

import { useState, useEffect } from "react";
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
  FileText
} from "lucide-react";
import { DocumentItem } from "./DocumentCard";
import { SearchableSelect, SearchableOption } from "./SearchableSelect";
import { formatPeriodTerm } from "@/lib/utils";

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
  const [title, setTitle] = useState(initialDoc.title);
  const [category, setCategory] = useState<"EXAMEN" | "LECCION" | "TALLER" | "CLASE">(initialDoc.category);
  const [subcategory, setSubcategory] = useState(initialDoc.subcategory);
  const [customSubcategory, setCustomSubcategory] = useState("");
  const [customDescription, setCustomDescription] = useState(initialDoc.customDescription || "");
  const [periodYear, setPeriodYear] = useState<number>(initialDoc.periodYear || new Date().getFullYear());
  const [periodTerm, setPeriodTerm] = useState<string>(formatPeriodTerm(initialDoc.periodTerm) || "1PAO");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

  const [subjectOptions, setSubjectOptions] = useState<SearchableOption[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
          let currentSubjId = "";
          for (const car of data.careers) {
            for (const sub of car.subjects) {
              if (!map.has(sub.id)) {
                map.set(sub.id, {
                  value: sub.id,
                  label: sub.name,
                  badge: sub.code,
                });
              }
              if (sub.code === initialDoc.subject.code || sub.name === initialDoc.subject.name) {
                currentSubjId = sub.id;
              }
            }
          }
          const options = Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
          setSubjectOptions(options);
          if (currentSubjId) {
            setSelectedSubjectId(currentSubjId);
          }
        }
      } catch (e) {
        console.error("Error al cargar materias para edición:", e);
      } finally {
        setLoadingSubjects(false);
      }
    }
    loadSubjects();
  }, [isOpen, initialDoc.subject]);

  // Sincronizar estado cuando cambia el documento
  useEffect(() => {
    if (isOpen) {
      setTitle(initialDoc.title);
      setCategory(initialDoc.category);
      setSubcategory(initialDoc.subcategory);
      setCustomDescription(initialDoc.customDescription || "");
      setPeriodYear(initialDoc.periodYear || new Date().getFullYear());
      setPeriodTerm(formatPeriodTerm(initialDoc.periodTerm) || "1PAO");
      setErrorMessage("");
      setSuccessMessage("");
    }
  }, [isOpen, initialDoc]);

  if (!isOpen) return null;

  const subcategoryOptions: Record<"EXAMEN" | "LECCION" | "TALLER" | "CLASE", string[]> = {
    EXAMEN: ["Parcial", "Final", "Mejoramiento", "Otro"],
    LECCION: ["Lección 1", "Lección 2", "Lección 3", "Lección 4", "Otro"],
    TALLER: ["Taller 1", "Taller 2", "Taller 3", "Taller 4", "Otro"],
    CLASE: ["Apuntes de Clase", "Diapositivas", "Guía Teórica", "Otro"],
  };

  const currentSubcategories = subcategoryOptions[category] || ["General", "Otro"];

  const years = Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i + 1);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage("El título del documento es obligatorio.");
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
          category,
          subcategory: finalSubcategory,
          customDescription: customDescription.trim() || null,
          periodYear,
          periodTerm,
          subjectId: selectedSubjectId || undefined,
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
      }, 1200);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error al guardar los cambios.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900/95 p-6 sm:p-8 text-white shadow-2xl overflow-y-auto max-h-[90vh]">
        
        {/* Botón Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Edit3 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Modificar Documento</h2>
            <p className="text-xs text-zinc-400">
              Panel de Moderación / Administración: Modifica el año, período, materia o categoría.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-5 flex items-center gap-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          
          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-blue-400" />
              Título del Documento *
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

          {/* Año Evaluado y Término Académico (PAO) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Año */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-400" />
                Año en que fue Evaluado *
              </label>
              <select
                value={periodYear}
                onChange={(e) => setPeriodYear(parseInt(e.target.value, 10))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Período Académico: 1PAO, 2PAO, PAE */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-blue-400" />
                Período Académico *
              </label>
              <select
                value={periodTerm}
                onChange={(e) => setPeriodTerm(e.target.value)}
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
                  const newCat = e.target.value as "EXAMEN" | "LECCION" | "TALLER" | "CLASE";
                  setCategory(newCat);
                  setSubcategory(subcategoryOptions[newCat]?.[0] || "General");
                }}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
              >
                <option value="EXAMEN">Examen</option>
                <option value="LECCION">Lección</option>
                <option value="TALLER">Taller / Deber</option>
                <option value="CLASE">Clase / Apuntes</option>
              </select>
            </div>

            {/* Subcategoría */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Subcategoría *
              </label>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
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

          {/* Acciones */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition disabled:opacity-50"
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

        </form>

      </div>
    </div>
  );
}
