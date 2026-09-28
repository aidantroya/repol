import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "STUDENT" | "MODERATOR" | "ADMIN";
      approvedContributions: number;
    } & DefaultSession["user"];
  }

  interface User {
    role?: "STUDENT" | "MODERATOR" | "ADMIN";
    approvedContributions?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    approvedContributions?: number;
  }
}
