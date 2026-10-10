"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { 
  Search, 
  GraduationCap, 
  FileText, 
  UploadCloud,
  Layers,
  ChevronRight,
  BookOpen,
  X,
  Filter,
  FolderArchive,
  Download,
  Lock,
  Sparkles,
  AlertCircle,
  Loader2
} from "lucide-react";
import JSZip from "jszip";
import { DocumentCard, DocumentItem } from "@/components/DocumentCard";
import { SearchableSelect, SearchableOption } from "@/components/SearchableSelect";
import { formatPeriodTerm, formatPeriodYear } from "@/lib/utils";
import Link from "next/link";

interface Career {
  id: string;
  name: string;
  slug: string;
  code: string;
  faculty?: string;
  subjects: Array<{
    id: string;
    name: string;
    code: string;
    slug: string;
    semester: number;
  }>;
}

export default function HomePage() {
  const { data: session, status: authStatus } = useSession();
  const [careers, setCareers] = useState<Career[]>([]);
  const [selectedCareer, setSelectedCareer] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [sortBy, setSortBy] = useState<string>("year_desc");
  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  const [downloadingZip, setDownloadingZip] = useState<{
    subjectCode: string;
    status: string;
    percent?: number;
  } | null>(null);

  const [zipModalState, setZipModalState] = useState<{
    open: boolean;
    subjectName: string;
    subjectCode: string;
    contributions: number;
    isUnauthenticated?: boolean;
  }>({
    open: false,
    subjectName: "",
    subjectCode: "",
    contributions: 0,
    isUnauthenticated: false,
  });

  // Cargar lista completa de carreras
  useEffect(() => {
    async function fetchCareers() {
      try {
        const res = await fetch("/api/careers");
        const data = await res.json();
        if (data.careers) {
          setCareers(data.careers);
        }
      } catch (e) {
        console.error("Error al cargar carreras:", e);
      }
    }
    fetchCareers();
  }, []);

  const activeCareerObj = useMemo(() => {
    return careers.find((c) => c.slug === selectedCareer);
  }, [careers, selectedCareer]);

  // Opciones para el selector desplegable con buscador de Carreras
  const careerOptions: SearchableOption[] = useMemo(() => {
    return careers.map((c) => ({
      value: c.slug,
      label: c.name,
      badge: c.code,
      subLabel: `${c.subjects.length} materias`,
    }));
  }, [careers]);

  // Opciones para el selector desplegable con buscador de Materias
  const subjectOptions: SearchableOption[] = useMemo(() => {
    if (activeCareerObj) {
      return activeCareerObj.subjects.map((s) => ({
        value: s.slug,
        label: s.name,
        badge: s.code,
      }));
    }

    // Si no hay carrera seleccionada, mostrar lista consolidada de todas las materias únicas
    const map = new Map<string, { label: string; badge: string; slug: string }>();
    for (const car of careers) {
      for (const sub of car.subjects) {
        if (!map.has(sub.slug)) {
          map.set(sub.slug, { label: sub.name, badge: sub.code, slug: sub.slug });
        }
      }
    }

    return Array.from(map.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((item) => ({
        value: item.slug,
        label: item.label,
        badge: item.badge,
      }));
  }, [activeCareerObj, careers]);

  // Cargar documentos según los filtros activos y ordenamiento
  useEffect(() => {
    async function fetchDocuments() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedCareer) params.append("career", selectedCareer);
        if (selectedSubject) params.append("subject", selectedSubject);
        if (selectedCategory) params.append("category", selectedCategory);
        if (selectedSubcategory) params.append("subcategory", selectedSubcategory);
        if (searchQuery) params.append("q", searchQuery);
        if (sortBy) params.append("sort", sortBy);

        const res = await fetch(`/api/documents?${params.toString()}`);
        const data = await res.json();
        if (data.documents) {
          setDocuments(data.documents);
        }
      } catch (e) {
        console.error("Error al cargar documentos:", e);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(() => {
      fetchDocuments();
    }, 200);

    return () => clearTimeout(timer);
  }, [selectedCareer, selectedSubject, selectedCategory, selectedSubcategory, searchQuery, sortBy]);

  const subcategoryFilters = {
    LECCION: ["Lección 1", "Lección 2", "Lección 3", "Lección 4", "Otro"],
    TALLER: ["Taller 1", "Taller 2", "Taller 3", "Taller 4", "Otro"],
    TAREA: ["Tareas", "Ejercicios Extras", "Guía de Problemas", "Otro"],
    EXAMEN: ["Parcial", "Final", "Mejoramiento"],
    CLASE: ["Apuntes de Clase", "Diapositivas", "Guía Teórica", "Otro"],
  };

  const hasActiveFilters = Boolean(
    selectedCareer || selectedSubject || selectedCategory || selectedSubcategory || searchQuery
  );

  // Agrupación jerárquica de documentos por Materia -> Carpetas de Categorías
  const groupedData = useMemo(() => {
    // Orden cronológico oficial ESPOL dentro del año:
    // 1. PAE (Extraordinario / vacaciones iniciales marzo-abril)
    // 2. 1PAO (Primer término ordinario mayo-septiembre)
    // 3. 2PAO (Segundo término ordinario octubre-febrero - el más reciente del año)
    const termOrder: Record<string, number> = {
      "2PAO": 3, "2T": 3,
      "1PAO": 2, "1T": 2,
      "PAE": 1, "3PAO": 1, "3T": 1, "Intensivo": 1,
    };
    
    // Sort comparator con soporte para año no especificado (S/F / 0)
    const sortDocs = (a: DocumentItem, b: DocumentItem) => {
      const yearA = a.periodYear || 0;
      const yearB = b.periodYear || 0;

      if (sortBy === "year_asc") {
        if (yearA === 0 && yearB !== 0) return 1;
        if (yearB === 0 && yearA !== 0) return -1;
        if (yearA !== yearB) return yearA - yearB;
        const termA = termOrder[a.periodTerm] ?? 0;
        const termB = termOrder[b.periodTerm] ?? 0;
        return termA - termB;
      }
      if (sortBy === "recent") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      // Default: year_desc (más reciente a más antiguo por año de evaluación)
      if (yearA === 0 && yearB !== 0) return 1;
      if (yearB === 0 && yearA !== 0) return -1;
      if (yearB !== yearA) return yearB - yearA;
      const termA = termOrder[a.periodTerm] ?? 0;
      const termB = termOrder[b.periodTerm] ?? 0;
      return termB - termA;
    };

    const sortedDocs = [...documents].sort(sortDocs);

    interface FolderGroup {
      category: "EXAMEN" | "LECCION" | "TALLER" | "TAREA" | "CLASE";
      label: string;
      iconColor: string;
      documents: DocumentItem[];
    }

    interface SubjectGroup {
      code: string;
      name: string;
      slug?: string;
      totalDocs: number;
      folders: FolderGroup[];
    }

    const map = new Map<string, SubjectGroup>();

    for (const doc of sortedDocs) {
      const sCode = doc.subject.code || "GENERAL";
      if (!map.has(sCode)) {
        map.set(sCode, {
          code: sCode,
          name: doc.subject.name,
          slug: doc.subject.name ? doc.subject.name.toLowerCase().replace(/\s+/g, "-") : undefined,
          totalDocs: 0,
          folders: [
            { category: "EXAMEN", label: "Exámenes", iconColor: "text-rose-400", documents: [] },
            { category: "LECCION", label: "Lecciones", iconColor: "text-amber-400", documents: [] },
            { category: "TALLER", label: "Talleres", iconColor: "text-emerald-400", documents: [] },
            { category: "CLASE", label: "Clases y Apuntes", iconColor: "text-blue-400", documents: [] },
            { category: "TAREA", label: "Material de Entrenamiento", iconColor: "text-purple-400", documents: [] },
          ],
        });
      }

      const grp = map.get(sCode)!;
      grp.totalDocs += 1;
      const folder = grp.folders.find((f) => f.category === doc.category);
      if (folder) {
        folder.documents.push(doc);
      }
    }

    // Filtrar carpetas vacías dentro de cada materia
    const result = Array.from(map.values()).map((s) => ({
      ...s,
      folders: s.folders.filter((f) => f.documents.length > 0),
    }));

    return result;
  }, [documents, sortBy]);

  const toggleSubject = (code: string) => {
    setOpenSubjects((prev) => ({
      ...prev,
      [code]: !prev[code],
    }));
  };

  const toggleFolder = (key: string) => {
    setOpenFolders((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleDocUpdated = (updatedDoc: DocumentItem) => {
    setDocuments((prev) => prev.map((d) => (d.id === updatedDoc.id ? { ...d, ...updatedDoc } : d)));
  };

  const handleDownloadSubjectZip = (codeOrSlug: string, subjectName: string, isSlug = false) => {
    if (authStatus === "unauthenticated" || !session?.user) {
      setZipModalState({
        open: true,
        subjectName,
        subjectCode: codeOrSlug,
        contributions: 0,
        isUnauthenticated: true,
      });
      return;
    }

    const isStaff = session.user.role === "ADMIN" || session.user.role === "MODERATOR";
    const userContributions = session.user.approvedContributions || 0;

    if (!isStaff && userContributions < 3) {
      setZipModalState({
        open: true,
        subjectName,
        subjectCode: codeOrSlug,
        contributions: userContributions,
        isUnauthenticated: false,
      });
      return;
    }

    // Usuario autorizado: descargar ZIP empaquetando en el navegador (0 bytes de Vercel Origin Transfer)
    const queryParam = isSlug ? `slug=${encodeURIComponent(codeOrSlug)}` : `code=${encodeURIComponent(codeOrSlug)}`;
    
    setDownloadingZip({
      subjectCode: codeOrSlug,
      status: "Obteniendo lista de archivos...",
      percent: 0,
    });

    (async () => {
      try {
        const manifestRes = await fetch(`/api/subjects/download-zip?${queryParam}`);
        if (!manifestRes.ok) {
          const errData = await manifestRes.json();
          alert(errData.error || "No se pudo obtener el material de la materia.");
          setDownloadingZip(null);
          return;
        }

        const data = await manifestRes.json();
        const allFiles: Array<{ folderPath: string; filename: string; downloadUrl: string; source: "r2" | "gdrive" }> = data.files || [];
        const zipFilename: string = data.zipFilename || `${codeOrSlug}_RePol.zip`;

        if (allFiles.length === 0) {
          alert("No hay archivos disponibles para descargar en esta materia.");
          setDownloadingZip(null);
          return;
        }

        const r2Files = allFiles.filter((f) => f.source === "r2");
        const driveFiles = allFiles.filter((f) => f.source === "gdrive");

        // 1. Si hay archivos en Cloudflare R2, empaquetarlos en un archivo ZIP con JSZip
        if (r2Files.length > 0) {
          const zip = new JSZip();
          let loadedCount = 0;

          for (const fileItem of r2Files) {
            try {
              setDownloadingZip({
                subjectCode: codeOrSlug,
                status: `Descargando R2 (${loadedCount + 1}/${r2Files.length}): ${fileItem.filename.substring(0, 25)}...`,
                percent: Math.round((loadedCount / r2Files.length) * 75),
              });

              const fileRes = await fetch(fileItem.downloadUrl);
              if (fileRes.ok) {
                const arrayBuf = await fileRes.arrayBuffer();
                const folder = zip.folder(fileItem.folderPath) || zip;
                folder.file(fileItem.filename, arrayBuf);
              }
            } catch (e) {
              console.warn(`Error al descargar ${fileItem.filename} desde R2:`, e);
            }
            loadedCount++;
          }

          setDownloadingZip({
            subjectCode: codeOrSlug,
            status: "Empaquetando archivo ZIP en tu navegador...",
            percent: 85,
          });

          const zipBlob = await zip.generateAsync(
            { type: "blob", compression: "DEFLATE", compressionOptions: { level: 5 } },
            (metadata) => {
              setDownloadingZip({
                subjectCode: codeOrSlug,
                status: `Comprimiendo: ${Math.round(metadata.percent)}%`,
                percent: 85 + Math.round((metadata.percent / 100) * 15),
              });
            }
          );

          // Disparar la descarga del archivo ZIP de Cloudflare R2
          const blobUrl = URL.createObjectURL(zipBlob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = zipFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }

        // 2. Si hay archivos alojados en Google Drive, disparar la descarga directa nativa del navegador
        // sin pasar un solo byte por Vercel
        if (driveFiles.length > 0) {
          setDownloadingZip({
            subjectCode: codeOrSlug,
            status: `Iniciando descarga de ${driveFiles.length} documento(s) de Drive...`,
            percent: 100,
          });

          // Disparar las descargas de Drive con un pequeño intervalo para no saturar el navegador
          driveFiles.forEach((df, index) => {
            setTimeout(() => {
              const link = document.createElement("a");
              link.href = df.downloadUrl;
              link.target = "_blank";
              link.rel = "noreferrer";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }, index * 600);
          });
        }

        setTimeout(() => {
          setDownloadingZip(null);
        }, driveFiles.length > 0 ? driveFiles.length * 600 + 800 : 500);
      } catch (err) {
        console.error("Error al generar el ZIP de la materia:", err);
        alert("Ocurrió un error al preparar los archivos de la materia.");
        setDownloadingZip(null);
      }
    })();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900/90 via-zinc-900/40 to-zinc-950 p-8 sm:p-12 text-center backdrop-blur-xl shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.15),rgba(255,255,255,0))]" />
        
        <div className="relative z-10 mx-auto max-w-3xl space-y-4">
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-sans">
            <span className="text-white">Repositorio</span>{" "}
            <span className="text-blue-500">Académico</span>
          </h1>
          
          <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Centraliza lecciones, talleres, clases y exámenes organizados por mallas y materias oficiales de la ESPOL. Explora los archivos por carpetas organizadas y ordenados por año de evaluación.
          </p>

          {/* Buscador Global Rápido */}
          <div className="pt-3 max-w-xl mx-auto">
            <div className="relative flex items-center">
              <Search className="absolute left-4 h-5 w-5 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por materia, código (ej. CCPG1043, MATG1045) o palabra clave..."
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-950/90 py-3.5 pl-12 pr-4 text-sm text-zinc-100 placeholder-zinc-500 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Sección de Filtros Inteligentes: Selectores Desplegables con Buscador */}
      <section className="relative z-30 space-y-5 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-400" />
            Filtros del Catálogo
          </h2>
          
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSelectedCareer("");
                setSelectedSubject("");
                setSelectedCategory("");
                setSelectedSubcategory("");
                setSearchQuery("");
              }}
              className="flex items-center gap-1 text-xs font-semibold text-rose-400 hover:text-rose-300 transition"
            >
              <X className="h-3.5 w-3.5" />
              <span>Limpiar filtros</span>
            </button>
          )}
        </div>

        {/* Grilla de Selectores Desplegables con Búsqueda Integrada */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Selector de Carrera */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5 text-blue-400" />
              <span>Carrera:</span>
            </label>
            <SearchableSelect
              options={careerOptions}
              value={selectedCareer}
              onChange={(newCareer) => {
                setSelectedCareer(newCareer);
                setSelectedSubject("");
              }}
              placeholder="Todas las Carreras"
              searchPlaceholder="Escribe el nombre o código de la carrera..."
              allowClear={true}
            />
          </div>

          {/* Selector de Materia con Buscador */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-blue-400" />
              <span>Materia:</span>
            </label>
            <SearchableSelect
              options={subjectOptions}
              value={selectedSubject}
              onChange={(newSubject) => setSelectedSubject(newSubject)}
              placeholder="Todas las materias..."
              searchPlaceholder="Escribe código (ej. CCPG1043) o nombre de la materia..."
              allowClear={true}
            />
          </div>

        </div>

        {/* Filtros de Categorías de Documentos */}
        <div className="pt-2 border-t border-zinc-800/80 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-zinc-400 mr-2 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-zinc-400" /> Categoría:
            </span>

            {[
              { id: "", label: "Todos los Tipos" },
              { id: "EXAMEN", label: "Exámenes" },
              { id: "LECCION", label: "Lecciones" },
              { id: "TALLER", label: "Talleres" },
              { id: "CLASE", label: "Clases y Apuntes" },
              { id: "TAREA", label: "Material de Entrenamiento" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSelectedSubcategory("");
                }}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedCategory === cat.id
                    ? "bg-zinc-100 text-zinc-950 shadow"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Filtro específico de subcategoría */}
          {selectedCategory && (
            <div className="flex flex-wrap items-center gap-2 pt-1 animate-in fade-in duration-200">
              <span className="text-xs text-zinc-500">Subcategoría:</span>
              <button
                onClick={() => setSelectedSubcategory("")}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  !selectedSubcategory ? "bg-blue-500/20 text-blue-300 font-bold" : "text-zinc-400 hover:text-white"
                }`}
              >
                Todos
              </button>
              {subcategoryFilters[selectedCategory as keyof typeof subcategoryFilters]?.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubcategory(selectedSubcategory === sub ? "" : sub)}
                  className={`rounded-md px-2.5 py-1 text-xs transition ${
                    selectedSubcategory === sub
                      ? "bg-blue-600 text-white font-semibold shadow-sm"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Resultados de Documentos */}
      <section className="relative z-10 space-y-6">
        
        {/* Descarga de Materia Completa en ZIP si hay una materia seleccionada */}
        {selectedSubject && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-950/40 via-blue-900/20 to-zinc-900/60 border border-blue-500/30 p-4 sm:p-5 rounded-2xl shadow-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <FolderArchive className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">¿Deseas descargar todo el material de esta materia?</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Descarga un archivo ZIP organizado por carpetas con todos los exámenes, lecciones, talleres y clases ordenados por año.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const activeSubjObj = subjectOptions.find((s) => s.value === selectedSubject);
                handleDownloadSubjectZip(selectedSubject, activeSubjObj?.label || "la materia seleccionada", true);
              }}
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition active:scale-95 shrink-0"
              title="Descargar todos los documentos de esta materia en formato .zip"
            >
              <Download className="h-4 w-4" />
              <span>Descargar ZIP Completo</span>
            </button>
          </div>
        )}

        {/* Barra superior de resultados con Selector de Vista y Ordenamiento */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">Documentos Disponibles</h2>
            <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-300 border border-zinc-700">
              {documents.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Control de Ordenamiento */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium hidden sm:inline">Ordenar por:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Criterio de ordenamiento de documentos"
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="year_desc">📅 Año evaluado: Más reciente a más antiguo</option>
                <option value="year_asc">📅 Año evaluado: Más antiguo a más reciente</option>
                <option value="recent">⚡ Fecha de subida: Más reciente</option>
              </select>
            </div>

            <Link
              href="/upload"
              className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition pl-1"
            >
              <span>Subir aporte</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-56 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-5 animate-pulse"
              />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-zinc-800/80 bg-zinc-900/30 p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-400 mb-4">
              <FileText className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No se encontraron documentos</h3>
            <p className="text-sm text-zinc-400 max-w-md mb-6">
              Aún no hay aportes aprobados con los filtros seleccionados. ¡Sé el primero en subir un examen o lección!
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition"
            >
              <UploadCloud className="h-4 w-4" />
              <span>Contribuir Material</span>
            </Link>
          </div>
        ) : (
          /* =================== VISTA POR MATERIAS Y CARPETAS =================== */
          <div className="space-y-6">
            {groupedData.map((subj) => {
              const isSubjOpen = Boolean(openSubjects[subj.code]); // Cerrado por defecto
              return (
                <div
                  key={subj.code}
                  className="rounded-3xl border border-zinc-800 bg-zinc-900/40 overflow-hidden backdrop-blur-sm transition shadow-lg"
                >
                  {/* Encabezado de Materia */}
                  <div
                    onClick={() => toggleSubject(subj.code)}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-zinc-900/80 hover:bg-zinc-800/60 cursor-pointer ${
                      isSubjOpen ? "border-b border-zinc-800/80" : ""
                    } transition`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm shrink-0">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">{subj.name}</h3>
                          <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs font-mono text-blue-400 border border-blue-500/20 font-semibold">
                            {subj.code}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {subj.totalDocs} documento(s) disponible(s) ordenados por año de evaluación
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      {/* Botón Descargar Materia en un ZIP */}
                      <button
                        type="button"
                        disabled={downloadingZip?.subjectCode === subj.code}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadSubjectZip(subj.code, subj.name, false);
                        }}
                        className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold shadow-md transition active:scale-95 group ${
                          downloadingZip?.subjectCode === subj.code
                            ? "bg-blue-600/40 border border-blue-400/50 text-blue-200 cursor-wait"
                            : "bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30"
                        }`}
                        title={`Descargar todo el material de ${subj.name} (${subj.code}) en formato ZIP`}
                      >
                        {downloadingZip?.subjectCode === subj.code ? (
                          <>
                            <Loader2 className="h-4 w-4 text-blue-300 animate-spin" />
                            <span className="max-w-[200px] truncate">{downloadingZip.status}</span>
                          </>
                        ) : (
                          <>
                            <FolderArchive className="h-4 w-4 text-blue-400 group-hover:text-white" />
                            <span>Descargar la materia en un ZIP</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400 font-medium hidden md:inline">
                          {isSubjOpen ? "Contraer" : "Expandir"}
                        </span>
                        <div className="h-8 w-8 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-300">
                          <ChevronRight
                            className={`h-4 w-4 transition-transform duration-200 ${
                              isSubjOpen ? "rotate-90" : ""
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contenido de la Materia: Carpetas de Categorías */}
                  {isSubjOpen && (
                    <div className="p-5 sm:p-6 space-y-6 animate-in fade-in duration-200">
                      {subj.folders.map((folder) => {
                        const folderKey = `${subj.code}-${folder.category}`;
                        const isFolderOpen = !!openFolders[folderKey]; // Cerrado por defecto

                        return (
                          <div
                            key={folder.category}
                            className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 overflow-hidden"
                          >
                            {/* Barra de la Carpeta */}
                            <div
                              onClick={() => toggleFolder(folderKey)}
                              className={`flex items-center justify-between px-4 py-3 bg-zinc-900/60 hover:bg-zinc-800/40 cursor-pointer ${
                                isFolderOpen ? "border-b border-zinc-800/60" : ""
                              } transition`}
                            >
                              <div className="flex items-center gap-2.5">
                                <FolderArchive className={`h-4 w-4 ${folder.iconColor}`} />
                                <span className="text-sm font-bold text-zinc-200">
                                  Carpeta: {folder.label}
                                </span>
                                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-zinc-300 border border-zinc-700">
                                  {folder.documents.length}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-xs text-zinc-500">
                                <span className="hidden sm:inline">
                                  {folder.documents[0]
                                    ? `Más reciente: ${formatPeriodYear(folder.documents[0].periodYear)} - ${formatPeriodTerm(folder.documents[0].periodTerm)}`
                                    : ""}
                                </span>
                                <ChevronRight
                                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                                    isFolderOpen ? "rotate-90" : ""
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Grilla de Documentos dentro de la Carpeta */}
                            {isFolderOpen && (
                              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-150">
                                {folder.documents.map((doc) => (
                                  <DocumentCard key={doc.id} doc={doc} onUpdated={handleDocUpdated} />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal de Requisito de 3 Aportes para Descarga en ZIP */}
      {zipModalState.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            
            {/* Icono y Encabezado */}
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
                <FolderArchive className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {zipModalState.isUnauthenticated 
                    ? "Inicia Sesión para Descargar en ZIP" 
                    : "Descarga de Materia en ZIP"}
                </h3>
                <p className="text-xs text-blue-400 font-medium mt-0.5">
                  Materia: {zipModalState.subjectName}
                </p>
              </div>
            </div>

            {/* Contenido del mensaje */}
            {zipModalState.isUnauthenticated ? (
              <div className="space-y-3 text-xs text-zinc-300">
                <p>
                  Debes iniciar sesión con tu cuenta oficial <strong>@espol.edu.ec</strong> para poder descargar la materia completa organizada en formato ZIP.
                </p>
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3.5 text-blue-300 flex items-start gap-2.5">
                  <Sparkles className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Una vez iniciada sesión y completadas al menos <strong>3 subidas de material</strong>, tendrás acceso ilimitado a las descargas completas en ZIP categorizadas.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between text-amber-300 font-bold text-sm">
                    <span className="flex items-center gap-1.5">
                      <Lock className="h-4 w-4" /> 3 Subidas Requeridas
                    </span>
                    <span className="bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30 text-xs">
                      {zipModalState.contributions}/3 completadas
                    </span>
                  </div>
                  <p className="text-zinc-300 leading-relaxed pt-1">
                    Para descargar toda la materia organizada en un archivo <strong>ZIP completo y categorizado</strong>, debes completar como mínimo <strong>3 subidas de material</strong> en RePol.
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3.5 text-xs text-zinc-400 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <p>
                    ¡Recuerda que puedes seguir descargando <strong>cada documento individualmente</strong> sin ningún límite! Sube tus lecciones, talleres o exámenes para desbloquear las descargas en ZIP.
                  </p>
                </div>
              </div>
            )}

            {/* Botones de Acción */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              {zipModalState.isUnauthenticated ? (
                <Link
                  href="/auth/signin"
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition active:scale-95"
                >
                  <span>Iniciar Sesión</span>
                </Link>
              ) : (
                <Link
                  href="/upload"
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition active:scale-95"
                >
                  <UploadCloud className="h-4 w-4" />
                  <span>Subir Aporte ({Math.max(0, 3 - zipModalState.contributions)} restantes)</span>
                </Link>
              )}
              <button
                type="button"
                onClick={() => setZipModalState((prev) => ({ ...prev, open: false }))}
                className="w-full sm:w-auto rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 py-2.5 px-4 text-xs font-semibold text-zinc-300 transition"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}


