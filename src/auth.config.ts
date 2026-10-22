import type { NextAuthConfig } from "next-auth";
import { parseRole } from "@/lib/roles";

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/entrar",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      if (path.startsWith("/app/admin")) {
        return auth?.user?.role === "ADMIN";
      }
      if (path.startsWith("/app")) {
        const role = auth?.user?.role;
        return !!auth && (role === "ORGANIZER" || role === "ADMIN");
      }
      if (path.startsWith("/participante")) {
        return !!auth && auth.user?.role === "PARTICIPANT";
      }
      return true;
    },
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      if (user && "role" in user && typeof user.role === "string") {
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      if (session.user && typeof token.role === "string") {
        session.user.role = parseRole(token.role);
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
