"use server";

import { AuthError } from "next-auth";
import { isParticipantLoginEmail } from "@/lib/participant-account";
import { linkParticipantInscriptions } from "@/lib/participant-link";
import { findUserByLogin } from "@/lib/user-login";
import { signIn, signOut } from "@/auth";

function isDatabaseUnreachable(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return code === "P1001" || code === "P1017" || code === "P1002";
}

export async function loginOrganizer(formData: FormData) {
  const login = String(formData.get("login") ?? formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "").trim();

  let user;
  try {
    user = await findUserByLogin(login);
  } catch (error) {
    if (isDatabaseUnreachable(error)) {
      return { error: "No hay conexión con la base de datos. Inténtalo de nuevo en unos segundos." };
    }
    throw error;
  }
  if (user?.active && user.role === "PARTICIPANT") {
    await linkParticipantInscriptions(user.id, {
      documentId: user.documentId,
      email: isParticipantLoginEmail(user.email) ? null : user.email,
    });
  }

  const defaultNext =
    user?.role === "ADMIN" ? "/app/admin" : user?.role === "PARTICIPANT" ? "/participante" : "/app";
  const next = nextRaw.startsWith("/") ? nextRaw : defaultNext;

  try {
    await signIn("credentials", {
      login,
      ...(login.includes("@") ? { email: login.toLowerCase() } : {}),
      password,
      redirectTo: next,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Usuario o contraseña incorrectos." };
    }
    throw error;
  }
}

export async function logoutOrganizer() {
  await signOut({ redirectTo: "/" });
}
