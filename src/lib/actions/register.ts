"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { isValidDocumentId, normalizeDocumentId } from "@/lib/document-id";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import { linkParticipantInscriptions } from "@/lib/participant-link";
import { isValidMobilePhone, normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import {
  dataProcessingAcceptanceWrite,
  requireDataProcessingAccepted,
} from "@/lib/data-processing";
import { isStrongEnoughPassword } from "@/lib/self-register";

export async function registerParticipant(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const documentRaw = String(formData.get("documentId") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "").trim();
  const next = nextRaw.startsWith("/") ? nextRaw : "/participante";

  if (name.length < 2) return { error: "Escribe tu nombre." };
  if (!isValidMobilePhone(phoneRaw)) {
    return { error: "El celular debe tener 10 dígitos y empezar por 3." };
  }
  if (!isValidDocumentId(documentRaw)) {
    return { error: "La cédula debe tener entre 5 y 15 dígitos." };
  }
  if (emailRaw && !isValidEmail(emailRaw)) return { error: "El correo no es válido." };
  if (!isStrongEnoughPassword(password)) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }
  const consentError = requireDataProcessingAccepted(formData);
  if (consentError) return consentError;

  const documentId = normalizeDocumentId(documentRaw);
  const phone = normalizePhone(phoneRaw);
  const email = emailRaw ? normalizeEmail(emailRaw) : `cedula+${documentId}@participante.tribanda`;

  const existingDoc = await prisma.user.findFirst({ where: { documentId } });
  if (existingDoc) {
    return { error: "Ya tienes cuenta. Entra con tu cédula y contraseña." };
  }
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) return { error: "Ese correo ya está en otra cuenta." };

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      documentId,
      passwordHash,
      role: "PARTICIPANT",
      ...dataProcessingAcceptanceWrite(),
    },
  });
  await prisma.$executeRaw`UPDATE User SET phone = ${phone} WHERE id = ${user.id}`;

  await prisma.player.updateMany({
    where: { documentId },
    data: { phone, ...(emailRaw ? { email } : {}) },
  });
  await linkParticipantInscriptions(user.id, {
    documentId,
    email: emailRaw ? email : null,
  });

  try {
    await signIn("credentials", {
      login: documentId,
      password,
      redirectTo: next,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "La cuenta se creó. Entra con tu cédula." };
    }
    throw error;
  }
}
