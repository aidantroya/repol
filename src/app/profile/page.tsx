"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Award, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  UploadCloud, 
  FileText, 
  Loader2, 
  ShieldCheck 
} from "lucide-react";
import { getCategoryBadgeColor, getCategoryLabel } from "@/lib/utils";
import Link from "next/link";

interface UserSubmission {
  id: string;
  title: string;
  description?: string | null;
  fileSize: number;
  category: "CLASE" | "LECCION" | "TALLER" | "EXAMEN";
  subcategory: string;
  customDescription?: string | null;
  periodYear: number;
  periodTerm: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  fileUrl: string;
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
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [promotionRequested, setPromotionRequested] = useState(false);
  const [promotionMessage, setPromotionMessage] = useState("");

  const user = session?.user;
  const contributions = user?.approvedContributions || 0;
  const isAdmin = user?.role === "ADMIN" || user?.role === "MODERATOR";
  const progressPercent = Math.min(100, Math.round((contributions / 10) * 100));

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    async function loadSubmissions() {
      try {
        const res = await fetch("/api/submissions");
        const data = await res.json();
        if (data.submissions) {
          setSubmissions(data.submissions);
        }
      } catch (e) {
        console.error("Error al cargar envíos:", e);
      } finally {
        setLoading(false);
      }
    }
    if (session?.user) {
      loadSubmissions();
    }
  }, [session]);

  const handleRequestPromotion = async () => {
    setPromotionLoading(true);
    try {
      const res = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: `He alcanzado ${contributions} documentos académicos aprobados en la plataforma.`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setPromotionRequested(true);
        setPromotionMessage(data.message);
      } else {
        setPromotionMessage(data.error);
      }
    } catch (e) {
      console.error("Error al solicitar ascenso:", e);
    } finally {
      setPromotionLoading(false);
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
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      
      {/* Tarjeta de Perfil y Gamificación */}
      <div className="rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900/90 to-zinc-950 p-6 sm:p-8 backdrop-blur-sm shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          
          <div className="flex items-center gap-4">
            {user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name || "Usuario"}
                className="h-16 w-16 rounded-2xl border-2 border-zinc-700 object-cover shadow-md"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold text-xl">
                {user?.name?.[0] || "U"}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white">{user?.name || "Estudiante"}</h1>
                {isAdmin ? (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-bold text-amber-400">
                    <ShieldCheck className="h-3.5 w-3.5" /> Administrador
                  </span>
                ) : (
                  <span className="rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 text-xs font-medium text-blue-400">
                    Estudiante Colaborador
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">{user?.email}</p>
            </div>
          </div>

          <Link
            href="/upload"
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Aportar Nuevo Material</span>
          </Link>
        </div>

        {/* Sección de Meta de 10 Contribuciones para Administrador */}
        {!isAdmin && (
          <div className="mt-8 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Award className={`h-5 w-5 ${contributions >= 10 ? "text-amber-400" : "text-zinc-400"}`} />
                  <span>Meta de Moderación: Rango de Administrador</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                  Alcanza **10 documentos aprobados** por la comunidad para desbloquear el derecho a solicitar permisos de Administrador y moderar la plataforma.
                </p>
              </div>

              {/* Botón de solicitud si cumple >= 10 */}
              {contributions >= 10 ? (
                <button
                  onClick={handleRequestPromotion}
                  disabled={promotionLoading || promotionRequested}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-xs font-bold text-zinc-950 shadow-md shadow-amber-500/20 hover:scale-105 transition disabled:opacity-50"
                >
                  {promotionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span>{promotionRequested ? "Solicitud en Revisión" : "¡Solicitar Rango Admin!"}</span>
                </button>
              ) : (
                <div className="text-right">
                  <span className="text-xs font-semibold text-zinc-400">Te faltan</span>
                  <div className="text-lg font-bold text-blue-400">{10 - contributions} documentos</div>
                </div>
              )}
            </div>

            {/* Barra de progreso */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-zinc-400 mb-1.5 font-medium">
                <span>Progreso ({contributions}/10 aprobados)</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
                <div
                  className={`h-full transition-all duration-700 ${
                    contributions >= 10 ? "bg-amber-400" : "bg-gradient-to-r from-blue-600 to-indigo-500"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {promotionMessage && (
              <div className="mt-3 text-xs text-amber-300 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                {promotionMessage}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Historial de Documentos Enviados */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-400" />
            Tus Contribuciones ({submissions.length})
          </h2>
        </div>

        {submissions.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <UploadCloud className="h-10 w-10 text-zinc-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">Aún no has enviado documentos</h3>
            <p className="text-xs text-zinc-400 mt-1 mb-4">
              Comparte tus apuntes, lecciones o exámenes resueltos para sumar puntos.
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition"
            >
              Subir tu primer documento
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub) => (
              <div
                key={sub.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 hover:border-zinc-700 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${getCategoryBadgeColor(
                        sub.category
                      )}`}
                    >
                      {getCategoryLabel(sub.category)}
                    </span>
                    <span className="text-xs font-semibold text-zinc-300">{sub.subcategory}</span>
                    <span className="text-xs text-zinc-500 font-mono">
                      • {sub.periodYear}-{sub.periodTerm}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-zinc-100">{sub.title}</h3>
                  <div className="text-xs text-zinc-400">
                    {sub.subject.name} <span className="font-mono text-blue-400">({sub.subject.code})</span> • {sub.subject.career?.name || sub.subject.careers?.[0]?.career.name || "ESPOL"}
                  </div>

                  {sub.status === "REJECTED" && sub.rejectionReason && (
                    <div className="text-xs text-rose-300 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 mt-2">
                      <span className="font-semibold">Motivo del rechazo:</span> {sub.rejectionReason}
                    </div>
                  )}
                </div>

                {/* Estado de la solicitud */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  {sub.status === "APPROVED" && (
                    <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Aprobado (+1)</span>
                    </div>
                  )}

                  {sub.status === "PENDING" && (
                    <div className="flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-400">
                      <Clock className="h-3.5 w-3.5" />
                      <span>En Revisión</span>
                    </div>
                  )}

                  {sub.status === "REJECTED" && (
                    <div className="flex items-center gap-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 px-3 py-1 text-xs font-semibold text-rose-400">
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Rechazado</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
