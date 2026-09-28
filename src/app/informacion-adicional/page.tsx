import Link from "next/link";
import { Shield, BookOpen, Scale, ArrowLeft, AlertCircle, Lock, Users } from "lucide-react";

export const metadata = {
  title: "Información Adicional - RePol Repositorio Académico",
  description: "Términos, política de retiro y consideraciones sobre el repositorio académico colaborativo RePol.",
};

export default function InformacionAdicionalPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      
      {/* Botón Volver */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4 text-blue-400" />
          <span>Volver al Catálogo</span>
        </Link>
      </div>

      {/* Título Principal */}
      <div className="space-y-3 border-b border-zinc-800 pb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-400">
          <Scale className="h-3.5 w-3.5" />
          <span>Transparencia & Normas de Uso</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-sans">
          Información Adicional
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-2xl">
          Conoce los lineamientos de funcionamiento, el marco de responsabilidad comunitaria y el protocolo de retiro de material de <span className="text-zinc-200 font-semibold">RePol</span>.
        </p>
      </div>

      {/* Propósito de RePol */}
      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-5 sm:p-6 space-y-2">
        <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-400" />
          Propósito y Funcionamiento Colaborativo
        </h2>
        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
          <strong className="text-white">RePol</strong> es una plataforma de apoyo al estudio creada de forma autónoma por estudiantes universitarios. Su objetivo principal es facilitar la organización del material pedagógico (lecciones pasadas, exámenes anteriores, talleres y notas de estudio) para apoyar la autoevaluación y la preparación académica formativa de la comunidad.
        </p>
      </div>

      {/* Puntos y directrices */}
      <div className="space-y-4 text-xs sm:text-sm">
        
        {/* Independencia */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-400" />
            Independencia y Fines Referenciales
          </h3>
          <p className="text-zinc-400 leading-relaxed">
            RePol es una iniciativa académica estudiantil independiente. No representa ni sustituye a ningún canal institucional o administrativo universitario. Las denominaciones de materias, mallas y códigos se utilizan exclusivamente como referencias organizativas para facilitar la búsqueda temática de los estudiantes.
          </p>
        </div>

        {/* Indexación de Enlaces */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-indigo-400" />
            Organización e Indexación de Material
          </h3>
          <p className="text-zinc-400 leading-relaxed">
            La plataforma funciona como un catálogo estructurado para clasificar y organizar recursos educativos compartidos por los propios estudiantes (a través de enlaces en la nube y almacenamiento distribuido). El contenido es moderado comunitariamente para garantizar su pertinencia pedagógica.
          </p>
        </div>

        {/* Política de Retiro / Takedown */}
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400" />
            Protocolo de Retiro Inmediato (Takedown)
          </h3>
          <p className="text-zinc-300 leading-relaxed">
            Se respeta plenamente el trabajo de los docentes y la titularidad de los contenidos. Si eres profesor, autor o titular de derechos sobre algún documento indexado y requieres su desindexación, puedes solicitar el retiro inmediato utilizando el botón de reporte disponible en la ficha de cada documento. Toda solicitud formal de retiro es atendida con máxima prioridad en un plazo menor a 24 horas.
          </p>
        </div>

        {/* Uso Ético */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Scale className="h-4 w-4 text-amber-400" />
            Compromiso de Honestidad y Uso Ético
          </h3>
          <p className="text-zinc-400 leading-relaxed">
            Los recursos recopilados están destinados exclusivamente a la práctica y preparación personal previa. Queda estrictamente prohibido el uso no autorizado o indebido durante evaluaciones activas. Cada estudiante asume la responsabilidad ética y académica en el uso que decida dar a las herramientas de estudio.
          </p>
        </div>

        {/* Privacidad y Gratuidad */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Lock className="h-4 w-4 text-emerald-400" />
            Privacidad y Ausencia de Fines Comerciales
          </h3>
          <p className="text-zinc-400 leading-relaxed">
            RePol es una herramienta 100% gratuita y sin fines de lucro. No recopila datos personales con fines comerciales ni incluye publicidad invasiva. El inicio de sesión se destina únicamente a gestionar las contribuciones comunitarias y el sistema de moderación.
          </p>
        </div>

      </div>

    </div>
  );
}
