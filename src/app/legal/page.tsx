import Link from "next/link";
import { Scale, ShieldCheck, ArrowLeft, AlertTriangle } from "lucide-react";

export const metadata = {
  title: "Aviso Legal y Política de Retiro - DocuPol / RePol",
  description: "Aviso Legal, Propiedad Intelectual y Política Expedita de Retiro (Takedown) de DocuPol.",
};

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      
      {/* Botón Volver */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4 text-blue-400" />
          <span>Volver al Repositorio</span>
        </Link>
      </div>

      {/* Cabecera Principal */}
      <div className="space-y-4 border-b border-zinc-800 pb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-400">
          <Scale className="h-4 w-4" />
          <span>Marco Legal y Transparencia Académica</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-sans">
          Aviso Legal, Propiedad Intelectual y Política de Retiro
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-3xl">
          Conoce los principios fundacionales, el marco de responsabilidad y los mecanismos de retiro expedito (takedown) de DocuPol.
        </p>
      </div>

      {/* Declaración de Principios */}
      <div className="rounded-3xl border border-blue-500/30 bg-blue-500/10 p-6 sm:p-8 space-y-3 shadow-xl shadow-blue-500/5">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-400" />
          Declaración de Principios de DocuPol
        </h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          DocuPol es un índice y directorio colaborativo sin fines de lucro, desarrollado de forma independiente por y para estudiantes, destinado exclusivamente a facilitar el estudio formativo, la autoevaluación y la preparación académica.
        </p>
      </div>

      {/* Artículos y Puntos Detallados */}
      <div className="space-y-6">
        
        {/* 01 */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-black text-blue-400">01</span>
            <h3 className="text-lg font-bold text-white">Independencia Institucional</h3>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed pl-9">
            DocuPol es un proyecto tecnológico independiente. No mantiene ningún tipo de relación jurídica, convenio oficial, respaldo, patrocinio, afiliación ni financiamiento con entidades universitarias oficiales, facultades, dependencias administrativas ni directivos. Las siglas, nombres de facultades o asignaturas se emplean estrictamente con fines referenciales y de orientación académica.
          </p>
        </div>

        {/* 02 */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-black text-indigo-400">02</span>
            <h3 className="text-lg font-bold text-white">Naturaleza de Directorio de Enlaces Públicos</h3>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed pl-9">
            DocuPol opera como un motor de búsqueda y agregador de metadatos académicos. La plataforma no aloja de forma nativa archivos con derechos de autor reservados en servidores propios cerrados; recopila y clasifica enlaces previamente difundidos en plataformas públicas de almacenamiento e intercambio en la nube (tales como Google Drive, Microsoft OneDrive, Dropbox u otros servicios).
          </p>
        </div>

        {/* 03 */}
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-black text-rose-400">03</span>
            <h3 className="text-lg font-bold text-white">Política Expedita de Retiro (Takedown)</h3>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed pl-9">
            Respetamos los derechos morales y patrimoniales de autores y docentes. Si usted es docente, autor legítimo o titular de derechos sobre una evaluación o guía indexada y desea su retiro inmediato, puede solicitarlo mediante el botón de reporte disponible en la ficha de cada documento o escribir directamente indicando la materia y la URL. El enlace será desindexado permanentemente en un plazo máximo de 24 horas laborables.
          </p>
          <div className="pl-9 pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600/20 border border-rose-500/40 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-600 hover:text-white transition"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Ir al Catálogo para Reportar un Documento</span>
            </Link>
          </div>
        </div>

        {/* 04 */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-black text-amber-400">04</span>
            <h3 className="text-lg font-bold text-white">Uso Ético y Responsabilidad del Usuario</h3>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed pl-9">
            El material indexado tiene como única finalidad la preparación académica, la autoevaluación y la consulta de antecedentes bibliográficos de exámenes pasados. Se prohíbe taxativamente su uso fraudulento durante evaluaciones o exámenes activos. Cada usuario asume la total responsabilidad ética, académica y disciplinaria derivada del uso o consulta que decida darle a la información indexada.
          </p>
        </div>

        {/* 05 */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-black text-emerald-400">05</span>
            <h3 className="text-lg font-bold text-white">Privacidad de Datos y Ausencia de Fines de Lucro</h3>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed pl-9">
            DocuPol es un servicio 100% libre y gratuito. No comercializamos datos personales ni insertamos publicidad invasiva. La autenticación se utiliza exclusivamente para la sincronización de favoritos y la atribución comunitaria de aportes en moderación.
          </p>
        </div>

      </div>

    </div>
  );
}
