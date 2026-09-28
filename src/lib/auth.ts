import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    // Proveedor de desarrollo / demo para pruebas inmediatas si aún no se configuran credenciales de Google Cloud
    CredentialsProvider({
      id: "demo-login",
      name: "Acceso Demo Universitario",
      credentials: {
        email: { label: "Correo Universitario", type: "email", placeholder: "estudiante@universidad.edu" },
        name: { label: "Nombre Completo", type: "text", placeholder: "Aidan Estudiante" },
        role: { label: "Rol Simulado", type: "text", placeholder: "STUDENT o ADMIN" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        const role = (credentials.role === "ADMIN" ? "ADMIN" : "STUDENT") as "ADMIN" | "STUDENT";

        // Buscar o crear usuario en la base de datos
        try {
          let user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email: credentials.email,
                name: credentials.name || "Usuario Universitario",
                role: role,
                approvedContributions: role === "ADMIN" ? 12 : 3,
                image: `https://api.dicebear.com/7.x/bottts/svg?seed=${credentials.email}`,
              },
            });
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
            approvedContributions: user.approvedContributions,
          };
        } catch (error) {
          console.warn("DB not connected yet, using in-memory demo session:", error);
          return {
            id: "demo-user-id",
            email: credentials.email,
            name: credentials.name || "Estudiante Demo",
            image: `https://api.dicebear.com/7.x/bottts/svg?seed=${credentials.email}`,
            role: role,
            approvedContributions: role === "ADMIN" ? 12 : 3,
          };
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
        if (allowedDomain && !user.email?.endsWith(allowedDomain)) {
          return false; // Rechazar si no pertenece al dominio universitario permitido
        }

        try {
          if (user.email) {
            const existingUser = await prisma.user.findUnique({
              where: { email: user.email },
            });

            if (!existingUser) {
              await prisma.user.create({
                data: {
                  email: user.email,
                  name: user.name ?? "Estudiante",
                  image: user.image,
                  role: "STUDENT",
                },
              });
            }
          }
        } catch (e) {
          console.error("Error synchronizing Google user in DB:", e);
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
  },
  secret: process.env.NEXTAUTH_SECRET || "repol_fallback_secret_key_development",
};
