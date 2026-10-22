import { DefaultSession } from "next-auth";
import type { UserRole } from "@/lib/roles";

declare module "next-auth" {
  interface User {
    role?: string;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
  }
}
