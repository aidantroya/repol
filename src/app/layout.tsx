import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Sidebar } from "@/components/Sidebar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes("localhost")
      ? process.env.NEXTAUTH_URL
      : "https://repol.onrender.com"
  ),
  title: "RePol - Repositorio Académico Colaborativo",
  description: "Plataforma universitaria para centralizar, organizar y compartir clases, lecciones, talleres y exámenes.",
  icons: {
    icon: [
      { url: "/logo-icon.svg", type: "image/svg+xml" },
      { url: "/logo-icon.png", type: "image/png" },
    ],
    apple: [
      { url: "/logo-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/logo-icon.png",
  },
  openGraph: {
    title: "RePol - Repositorio Académico Colaborativo",
    description: "Plataforma universitaria para centralizar, organizar y compartir clases, lecciones, talleres y exámenes.",
    siteName: "RePol",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RePol - Repositorio Académico Colaborativo",
      },
    ],
    locale: "es_EC",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RePol - Repositorio Académico Colaborativo",
    description: "Plataforma universitaria para centralizar, organizar y compartir clases, lecciones, talleres y exámenes.",
    images: ["/og-image.png"],
  },
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
          <Sidebar />
          <div className="flex-1 flex flex-col pt-14 sm:pt-0 sm:pl-[70px] min-h-screen">
          <main className="flex-1">{children}</main>
            <Footer />
          </div>
          
          
        </Providers>
      </body>
    </html>
  );
}
