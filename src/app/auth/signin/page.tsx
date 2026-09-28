"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { 
  BookOpen, 
  ShieldCheck, 
  AlertTriangle, 
  Loader2, 
  Lock,
  ArrowRight
} from "lucide-react";

function SignInContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [isLoading, setIsLoading] = useState(false);

  const handleMicrosoftSignIn = async () => {
    setIsLoading(true);
    await signIn("azure-ad", { callbackUrl });
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-8 backdrop-blur-2xl shadow-2xl">
        
        {/* Logotipo e Identidad Institucional */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25 mb-4">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-400 mb-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Portal Académico Oficial</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            Bienvenido a RePol
          </h1>
          <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
            Repositorio Académico de la <strong>Escuela Superior Politécnica del Litoral</strong>
          </p>
        </div>

        {/* Notificación de Error / Acceso Denegado */}
        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <p className="font-bold text-rose-200">
                  {error === "Configuration"
                    ? "Configuración de Microsoft pendiente"
                    : error === "AccessDenied"
                    ? "Acceso no autorizado"
                    : "Aviso de inicio de sesión"}
                </p>
                <p className="mt-1 leading-relaxed text-rose-300/90">
                  {error === "Configuration"
                    ? "Aún no se han colocado las claves AZURE_AD_CLIENT_ID y AZURE_AD_CLIENT_SECRET en las variables de entorno de Vercel/archivo .env."
                    : error === "AccessDenied"
                    ? "Debes seleccionar tu cuenta institucional politécnica (@espol.edu.ec) para acceder."
                    : "No se pudo completar el inicio de sesión con Microsoft. Por favor, inténtalo nuevamente."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Botón Oficial Microsoft 365 ESPOL */}
        <div className="space-y-4 pt-2">
          <button
            onClick={handleMicrosoftSignIn}
            disabled={isLoading}
            className="group flex w-full items-center justify-between rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3.5 text-sm font-semibold text-white shadow-xl hover:border-blue-500/60 hover:bg-zinc-900 transition active:scale-98 disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              {/* Logo Oficial de Microsoft (4 cuadrados) */}
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              <div className="text-left">
                <span className="block text-sm font-semibold text-white">Continuar con Microsoft ESPOL</span>
                <span className="block text-[11px] text-zinc-400 font-normal">Cuenta institucional @espol.edu.ec</span>
              </div>
            </div>

            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            ) : (
              <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition" />
            )}
          </button>

          {/* Información de Seguridad y Persistencia */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
              <Lock className="h-3.5 w-3.5 text-blue-400" />
              <span>Autenticación Institucional Cifrada</span>
            </div>
            <ul className="text-[11px] text-zinc-400 space-y-1 list-disc list-inside leading-relaxed">
              <li>Ingreso seguro mediante el portal de <strong>Microsoft 365 ESPOL</strong>.</li>
              <li>Tu sesión se mantendrá activa en este dispositivo.</li>
              <li>Validación instantánea para estudiantes y docentes politécnicos.</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
