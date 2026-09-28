"use client";

import { useState, useEffect, useMemo } from "react";
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
  Scale,
  ShieldCheck
} from "lucide-react";
import { DocumentCard, DocumentItem } from "@/components/DocumentCard";
import { SearchableSelect, SearchableOption } from "@/components/SearchableSelect";
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
  const [careers, setCareers] = useState<Career[]>([]);
  const [selectedCareer, setSelectedCareer] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Cargar documentos según los filtros activos
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
  }, [selectedCareer, selectedSubject, selectedCategory, selectedSubcategory, searchQuery]);

  const subcategoryFilters = {
    LECCION: ["Lección 1", "Lección 2", "Lección 3", "Lección 4", "Otro"],
    TALLER: ["Taller 1", "Taller 2", "Taller 3", "Taller 4", "Otro"],
    EXAMEN: ["Parcial", "Final", "Mejoramiento"],
    CLASE: ["Apuntes de Clase", "Diapositivas", "Guía Teórica"],
  };

  const hasActiveFilters = Boolean(
    selectedCareer || selectedSubject || selectedCategory || selectedSubcategory || searchQuery
  );

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
            Centraliza lecciones, talleres, clases y exámenes organizados por mallas y códigos oficiales. Si una materia es compartida entre varias carreras, encontrarás su material unificado en un solo lugar.
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
              { id: "LECCION", label: "Lecciones" },
              { id: "TALLER", label: "Talleres" },
              { id: "EXAMEN", label: "Exámenes" },
              { id: "CLASE", label: "Clases y Apuntes" },
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
                  Descarga un archivo ZIP organizado por carpetas con todos los exámenes, lecciones, talleres y clases.
                </p>
              </div>
            </div>

            <a
              href={`/api/subjects/download-zip?slug=${encodeURIComponent(selectedSubject)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition active:scale-95 shrink-0"
              title="Descargar todos los documentos de esta materia en formato .zip"
            >
              <Download className="h-4 w-4" />
              <span>Descargar ZIP Completo</span>
            </a>
          </div>
        )}

        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">Documentos Disponibles</h2>
            <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-300 border border-zinc-700">
              {documents.length}
            </span>
          </div>

          <Link
            href="/upload"
            className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition"
          >
            <span>Subir aporte</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </section>

      {/* Sección de Información Adicional: Aviso Legal, Propiedad Intelectual y Política de Retiro */}
      <section id="aviso-legal" className="relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 sm:p-10 backdrop-blur-sm space-y-8">
        <div className="space-y-3 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-400">
            <Scale className="h-3.5 w-3.5" />
            <span>Marco Legal & Transparencia</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
            Aviso Legal, Propiedad Intelectual y Política de Retiro
          </h2>
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs sm:text-sm text-zinc-300 leading-relaxed">
            <span className="font-bold text-blue-400">Declaración de Principios de DocuPol:</span> DocuPol es un índice y directorio colaborativo sin fines de lucro, desarrollado de forma independiente por y para estudiantes, destinado exclusivamente a facilitar el estudio formativo, la autoevaluación y la preparación académica.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 01 Independencia Institucional */}
          <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/60 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-black text-blue-500/40">01</span>
              <ShieldCheck className="h-5 w-5 text-blue-400" />
            </div>
            <h3 className="text-sm font-bold text-white">Independencia Institucional</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              DocuPol es un proyecto tecnológico independiente. No mantiene ningún tipo de relación jurídica, convenio oficial, respaldo, patrocinio, afiliación ni financiamiento con entidades universitarias oficiales, facultades, dependencias administrativas ni directivos. Las siglas, nombres de facultades o asignaturas se emplean estrictamente con fines referenciales y de orientación académica.
            </p>
          </div>

          {/* 02 Naturaleza de Directorio de Enlaces Públicos */}
          <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/60 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-black text-blue-500/40">02</span>
              <FolderArchive className="h-5 w-5 text-indigo-400" />
            </div>
            <h3 className="text-sm font-bold text-white">Naturaleza de Directorio de Enlaces Públicos</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              DocuPol opera como un motor de búsqueda y agregador de metadatos académicos. La plataforma no aloja de forma nativa archivos con derechos de autor reservados en servidores propios cerrados; recopila y clasifica enlaces previamente difundidos en plataformas públicas de almacenamiento e intercambio en la nube (tales como Google Drive, Microsoft OneDrive, Dropbox u otros servicios).
            </p>
          </div>

          {/* 03 Política Expedita de Retiro (Takedown) */}
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 space-y-3 md:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-black text-rose-500/40">03</span>
              <Scale className="h-5 w-5 text-rose-400" />
            </div>
            <h3 className="text-sm font-bold text-white">Política Expedita de Retiro (Takedown)</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Respetamos los derechos morales y patrimoniales de autores y docentes. Si usted es docente, autor legítimo o titular de derechos sobre una evaluación o guía indexada y desea su retiro inmediato, puede solicitarlo mediante el botón de reporte disponible en la ficha de cada documento o escribir directamente indicando la materia y la URL. El enlace será desindexado permanentemente en un plazo máximo de 24 horas laborables.
            </p>
          </div>

          {/* 04 Uso Ético y Responsabilidad del Usuario */}
          <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/60 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-black text-amber-500/40">04</span>
              <BookOpen className="h-5 w-5 text-amber-400" />
            </div>
            <h3 className="text-sm font-bold text-white">Uso Ético y Responsabilidad del Usuario</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              El material indexado tiene como única finalidad la preparación académica, la autoevaluación y la consulta de antecedentes bibliográficos de exámenes pasados. Se prohíbe taxativamente su uso fraudulento durante evaluaciones o exámenes activos. Cada usuario asume la total responsabilidad ética, académica y disciplinaria derivada del uso o consulta que decida darle a la información indexada.
            </p>
          </div>

          {/* 05 Privacidad de Datos y Ausencia de Fines de Lucro */}
          <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/60 p-5 space-y-3 md:col-span-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-black text-emerald-500/40">05</span>
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <h3 className="text-sm font-bold text-white">Privacidad de Datos y Ausencia de Fines de Lucro</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              DocuPol es un servicio 100% libre y gratuito. No comercializamos datos personales ni insertamos publicidad invasiva. La autenticación se utiliza exclusivamente para la sincronización de favoritos y la atribución comunitaria de aportes en moderación.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
