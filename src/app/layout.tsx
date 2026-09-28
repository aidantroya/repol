import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "RePol - Repositorio Académico Colaborativo",
  description: "Plataforma universitaria para centralizar, organizar y compartir clases, lecciones, talleres y exámenes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="bg-zinc-950 font-sans text-zinc-100 min-h-screen flex flex-col antialiased selection:bg-blue-500 selection:text-white">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          
          <footer className="border-t border-zinc-900 bg-zinc-950 py-8 text-xs text-zinc-500">
            <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
                <p>© {new Date().getFullYear()} RePol - Repositorio Académico</p>
                <span className="hidden sm:inline text-zinc-700">•</span>
                <a href="/feedback" className="text-zinc-400 hover:text-blue-400 underline-offset-4 hover:underline transition">
                  Reportar Bug o Sugerencia
                </a>
                <span className="hidden sm:inline text-zinc-700">•</span>
                <a href="/informacion-adicional" className="text-zinc-400 hover:text-blue-400 underline-offset-4 hover:underline transition">
                  Información adicional
                </a>
              </div>
              <p className="flex items-center gap-1.5 text-zinc-400 text-center sm:text-right">
                Directorio colaborativo estudiantil • Almacenamiento en Cloudflare R2
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
