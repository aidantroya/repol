"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { BookOpen, ShieldCheck, User } from "lucide-react";

export default function SignInPage() {
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const handleDemoSignIn = async (selectedRole: "STUDENT" | "ADMIN") => {
    setIsDemoLoading(true);
    const demoEmail = selectedRole === "ADMIN" ? "admin@espol.edu.ec" : "estudiante@espol.edu.ec";
    const demoName = selectedRole === "ADMIN" ? "Administrador Académico" : "Aidan Estudiante";
    
    await signIn("demo-login", {
      email: demoEmail,
      name: demoName,
      role: selectedRole,
      callbackUrl: "/",
    });
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-8 backdrop-blur-xl shadow-2xl">
        
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 mb-4">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Bienvenido a RePol</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Repositorio Académico Colaborativo Universitario
          </p>
        </div>

        <div className="space-y-4">
          
          {/* Botón Principal Google OAuth */}
          <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:border-zinc-500 hover:bg-zinc-900 transition active:scale-98"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
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
            <span>Continuar con Google Institucional</span>
          </button>

          <div className="relative flex items-center justify-center my-6">
            <div className="border-t border-zinc-800 w-full" />
            <span className="bg-zinc-900 px-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              O probar en modo desarrollo
            </span>
            <div className="border-t border-zinc-800 w-full" />
          </div>

          {/* Accesos rápidos de desarrollo para pruebas */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleDemoSignIn("STUDENT")}
              disabled={isDemoLoading}
              className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-center hover:border-blue-500/40 hover:bg-zinc-950 transition"
            >
              <User className="h-5 w-5 text-blue-400 mb-1.5" />
              <span className="text-xs font-bold text-white">Como Estudiante</span>
              <span className="text-[10px] text-zinc-500 mt-0.5">4 aprobados</span>
            </button>

            <button
              onClick={() => handleDemoSignIn("ADMIN")}
              disabled={isDemoLoading}
              className="flex flex-col items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-center hover:border-amber-500/40 hover:bg-amber-500/10 transition"
            >
              <ShieldCheck className="h-5 w-5 text-amber-400 mb-1.5" />
              <span className="text-xs font-bold text-amber-300">Como Administrador</span>
              <span className="text-[10px] text-zinc-500 mt-0.5">Panel de moderación</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
