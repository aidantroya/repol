"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { 
  BookOpen, 
  ShieldCheck, 
  AlertTriangle, 
  Loader2, 
  Lock
} from "lucide-react";

function SignInContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    await signIn("google", { callbackUrl });
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-8 backdrop-blur-2xl shadow-2xl">
        
        {/* Logotipo e Identidad */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25 mb-4">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-400 mb-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Acceso Académico ESPOL</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            Bienvenido a RePol
          </h1>
          <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
            Repositorio Académico Oficial de la Escuela Superior Politécnica del Litoral
          </p>
        </div>

        {/* Notificación de Error / Acceso Denegado */}
        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <p className="font-bold text-rose-200">Acceso no autorizado</p>
                <p className="mt-1 leading-relaxed text-rose-300/90">
                  {error === "AccessDenied"
                    ? "Debes seleccionar tu correo institucional de la ESPOL (@espol.edu.ec) para poder ingresar."
                    : "Ocurrió un inconveniente al iniciar sesión. Inténtalo nuevamente."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Botón Principal de Inicio con Google Institucional */}
        <div className="space-y-4 pt-2">
          <button
            onClick={handleSignIn}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3.5 text-sm font-semibold text-white shadow-xl hover:border-blue-500/60 hover:bg-zinc-900 transition active:scale-98 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                <span>Conectando con ESPOL...</span>
              </>
            ) : (
              <>
                {/* Icono Oficial de Google */}
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continuar con cuenta @espol.edu.ec</span>
              </>
            )}
          </button>

          {/* Información de Seguridad y Privacidad */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
              <Lock className="h-3.5 w-3.5 text-blue-400" />
              <span>Autenticación Segura y Cifrada</span>
            </div>
            <ul className="text-[11px] text-zinc-400 space-y-1 list-disc list-inside leading-relaxed">
              <li>Ingreso directo sin crear contraseñas adicionales.</li>
              <li>Tu sesión permanecerá iniciada en este dispositivo.</li>
              <li>Exclusivo para estudiantes y docentes con cuenta politécnica activa.</li>
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
