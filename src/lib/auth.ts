import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 días de sesión persistente
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "select_account",
          hd: "espol.edu.ec", // Sugiere y filtra directamente las cuentas @espol.edu.ec
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email?.toLowerCase().trim();

        // Validación estricta del dominio oficial de la ESPOL
        if (!email || !email.endsWith("@espol.edu.ec")) {
          return false; // Rechaza el ingreso si no es una cuenta institucional @espol.edu.ec
        }

        try {
          const existingUser = await prisma.user.findUnique({
            where: { email },
          });

          if (!existingUser) {
            await prisma.user.create({
              data: {
                email,
                name: user.name || email.split("@")[0],
                image: user.image || `https://api.dicebear.com/7.x/bottts/svg?seed=${email}`,
                role: "STUDENT",
                approvedContributions: 0,
              },
            });
          }
        } catch (e) {
          console.error("Error al sincronizar usuario institucional en DB:", e);
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role || "STUDENT";
        token.approvedContributions = (user as { approvedContributions?: number }).approvedContributions || 0;
      }

      if (trigger === "update" && session) {
        token.role = session.role;
        token.approvedContributions = session.approvedContributions;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "STUDENT" | "MODERATOR" | "ADMIN") || "STUDENT";
        session.user.approvedContributions = (token.approvedContributions as number) || 0;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET || "repol_fallback_secret_key_development",
};
