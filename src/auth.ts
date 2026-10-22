import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { normalizeDocumentId } from "@/lib/document-id";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        login: { label: "Email o cédula", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const login = String(credentials.login ?? credentials.email ?? "").trim();
        const password = String(credentials.password ?? "");
        if (!login || !password) return null;

        const { findUserByLogin } = await import("@/lib/user-login");
        const user = await findUserByLogin(login);
        if (!user || !user.active) return null;

        let ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok && user.role === "PARTICIPANT" && user.documentId) {
          const pwdDoc = normalizeDocumentId(password);
          if (pwdDoc) ok = await bcrypt.compare(pwdDoc, user.passwordHash);
        }
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
