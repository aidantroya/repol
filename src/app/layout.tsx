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
          
          <footer className="border-t border-zinc-900 bg-zinc-950 py-8 text-center text-xs text-zinc-500">
            <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p>© {new Date().getFullYear()} RePol - Repositorio Académico Colaborativo</p>
              <p className="flex items-center gap-1.5 text-zinc-400">
                Diseñado para estudiantes universitarios • Almacenamiento en Cloudflare R2
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
