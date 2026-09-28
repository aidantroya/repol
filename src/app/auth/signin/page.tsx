"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  BookOpen, 
  Mail, 
  KeyRound, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RotateCcw,
  Shield
} from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const [step, setStep] = useState<"EMAIL" | "OTP">("EMAIL");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Contador para reenvío de código
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Paso 1: Enviar Código OTP al correo institucional
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage("Por favor, ingresa tu correo electrónico.");
      return;
    }

    if (!cleanEmail.endsWith("@espol.edu.ec")) {
      setErrorMessage("Debes ingresar un correo institucional oficial de la ESPOL terminado en @espol.edu.ec");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No se pudo enviar el código de verificación.");
      }

      setSuccessMessage(data.message || "Código enviado a tu correo institucional.");
      if (data.devCode) {
        setDevOtpCode(data.devCode);
      } else {
        setDevOtpCode(null);
      }
      setStep("OTP");
      setCountdown(30); // 30 segundos de espera para reenvío
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al solicitar código";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Paso 2: Verificar el código OTP e iniciar sesión
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const cleanOtp = otp.trim();

    if (!cleanOtp || cleanOtp.length < 6) {
      setErrorMessage("Por favor, ingresa el código numérico de 6 dígitos.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn("espol-otp", {
        email: email.trim().toLowerCase(),
        otp: cleanOtp,
        redirect: false,
        callbackUrl: "/",
      });

      if (result?.error) {
        setErrorMessage(result.error);
        setIsLoading(false);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al verificar código";
      setErrorMessage(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[82vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-8 backdrop-blur-2xl shadow-2xl">
        
        {/* Cabecera / Identidad */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 mb-4">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-0.5 text-xs font-semibold text-blue-400 mb-2">
            <Shield className="h-3 w-3" />
            <span>Acceso Académico Oficial</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Ingreso a RePol</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Exclusivo para la comunidad politécnica de la <strong>ESPOL</strong>
          </p>
        </div>

        {/* Mensaje de Error */}
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* Mensaje de Éxito */}
        {successMessage && !errorMessage && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
            <p className="leading-relaxed">{successMessage}</p>
          </div>
        )}

        {/* PASO 1: Ingresar Correo Institucional */}
        {step === "EMAIL" && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Correo Electrónico Institucional
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@espol.edu.ec"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-500">
                Se enviará un código de verificación de 6 dígitos a tu bandeja politécnica.
              </p>
            </div>

            {/* Mantener sesión iniciada */}
            <div className="flex items-center gap-2 pt-1">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-blue-600 focus:ring-blue-500 focus:ring-offset-zinc-900 cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-xs text-zinc-300 cursor-pointer select-none">
                Mantener mi sesión iniciada
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition active:scale-98 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Enviando código...</span>
                </>
              ) : (
                <>
                  <span>Continuar con Correo</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* PASO 2: Ingresar Código OTP */}
        {step === "OTP" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="otp" className="block text-xs font-semibold text-zinc-300">
                  Código de Verificación (6 dígitos)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep("EMAIL");
                    setOtp("");
                    setErrorMessage("");
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  Cambiar correo
                </button>
              </div>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500">
                  <KeyRound className="h-4 w-4" />
                </div>
                <input
                  id="otp"
                  type="text"
                  maxLength={6}
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-10 pr-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-white placeholder-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                />
              </div>

              {devOtpCode && (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  <p className="font-semibold text-amber-300 mb-1">🔑 Código de prueba generado:</p>
                  <p className="text-white font-mono text-base font-bold tracking-widest bg-zinc-950/80 px-2 py-1 rounded inline-block">
                    {devOtpCode}
                  </p>
                  <p className="mt-1.5 text-[11px] text-amber-400/80 leading-relaxed">
                    Nota: Para enviar correos reales al buzón de Outlook ESPOL (@espol.edu.ec), añade la clave gratuita <code className="bg-zinc-800 px-1 py-0.5 rounded text-amber-200">RESEND_API_KEY</code> o credenciales SMTP en Vercel.
                  </p>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                <span>¿No te llegó el código?</span>
                {countdown > 0 ? (
                  <span className="text-zinc-500">Reenviar en {countdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1 font-medium text-blue-400 hover:text-blue-300 transition"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reenviar código</span>
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || otp.length < 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition active:scale-98 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Verificar e Iniciar Sesión</span>
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
