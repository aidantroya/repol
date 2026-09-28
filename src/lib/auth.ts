import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 días para mantener la sesión iniciada
  },
  providers: [
    // Proveedor Oficial de Correo Institucional ESPOL con Código OTP
    CredentialsProvider({
      id: "espol-otp",
      name: "Correo Institucional ESPOL",
      credentials: {
        email: { label: "Correo Institucional", type: "email", placeholder: "usuario@espol.edu.ec" },
        otp: { label: "Código de Verificación", type: "text", placeholder: "123456" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.otp) {
          throw new Error("El correo y el código de verificación son obligatorios.");
        }

        const email = credentials.email.trim().toLowerCase();
        const otp = credentials.otp.trim();

        // 1. Validar dominio institucional obligatorio
        if (!email.endsWith("@espol.edu.ec")) {
          throw new Error("Solo se permite el ingreso con correos oficiales @espol.edu.ec.");
        }

        // 2. Verificar el token OTP en la base de datos
        const tokenRecord = await prisma.verificationToken.findFirst({
          where: {
            identifier: email,
            token: otp,
          },
        });

        if (!tokenRecord) {
          throw new Error("Código de verificación incorrecto.");
        }

        if (tokenRecord.expires < new Date()) {
          // Eliminar token caducado
          await prisma.verificationToken.deleteMany({
            where: { identifier: email },
          });
          throw new Error("El código de verificación ha expirado. Por favor, solicita uno nuevo.");
        }

        // 3. Eliminar el token usado para evitar reuso
        await prisma.verificationToken.deleteMany({
          where: { identifier: email },
        });

        // 4. Buscar o crear el usuario en la base de datos
        const usernamePrefix = email.split("@")[0];
        const formattedName = usernamePrefix
          .replace(/[._-]/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());

        let user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              name: formattedName,
              role: "STUDENT",
              approvedContributions: 0,
              image: `https://api.dicebear.com/7.x/bottts/svg?seed=${email}`,
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
      },
    }),

    // Proveedor Google OAuth opcional (restringido a @espol.edu.ec)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email?.toLowerCase().endsWith("@espol.edu.ec")) {
          return false; // Rechazar si no es @espol.edu.ec
        }

        try {
          if (user.email) {
            const email = user.email.toLowerCase();
            const existingUser = await prisma.user.findUnique({
              where: { email },
            });

            if (!existingUser) {
              await prisma.user.create({
                data: {
                  email,
                  name: user.name ?? email.split("@")[0],
                  image: user.image || `https://api.dicebear.com/7.x/bottts/svg?seed=${email}`,
                  role: "STUDENT",
                },
              });
            }
          }
        } catch (e) {
          console.error("Error al sincronizar usuario Google:", e);
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
