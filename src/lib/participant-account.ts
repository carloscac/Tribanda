import bcrypt from "bcryptjs";
import { isValidDocumentId, normalizeDocumentId } from "@/lib/document-id";
import { prisma } from "@/lib/prisma";

/** Email interno cuando el participante no tiene correo (solo sistema). */
export function participantLoginEmail(documentId: string) {
  const doc = normalizeDocumentId(documentId);
  return `cedula+${doc}@participante.tribanda`;
}

export function isParticipantLoginEmail(email: string) {
  return email.startsWith("cedula+") && email.endsWith("@participante.tribanda");
}

export async function hashParticipantPassword(documentId: string) {
  return bcrypt.hash(normalizeDocumentId(documentId), 10);
}

/**
 * Crea o actualiza la cuenta PARTICIPANT al guardar un jugador con cédula.
 * Contraseña = la cédula (solo dígitos).
 */
export async function provisionParticipantUser(opts: {
  name: string;
  documentId: string;
  email?: string | null;
}): Promise<{ ok: true; userId: string } | { error: string }> {
  const documentId = normalizeDocumentId(opts.documentId);
  if (!isValidDocumentId(documentId)) {
    return { error: "La cédula debe tener entre 5 y 15 dígitos." };
  }

  const emailRaw = opts.email?.trim().toLowerCase() ?? "";

  const byDoc = await prisma.user.findFirst({ where: { documentId } });
  if (byDoc && byDoc.role !== "PARTICIPANT") {
    return { error: "Esa cédula ya está en uso por otra cuenta del sistema." };
  }

  if (emailRaw) {
    const emailTaken = await prisma.user.findFirst({
      where: { email: emailRaw, NOT: byDoc ? { id: byDoc.id } : undefined },
    });
    if (emailTaken) return { error: "Ese email ya está en otra cuenta." };
  }

  const email =
    emailRaw || (byDoc && !isParticipantLoginEmail(byDoc.email) ? byDoc.email : participantLoginEmail(documentId));

  if (byDoc) {
    const user = await prisma.user.update({
      where: { id: byDoc.id },
      data: {
        name: opts.name.trim(),
        documentId,
        email,
        active: true,
      },
    });
    return { ok: true, userId: user.id };
  }

  const emailFree = await prisma.user.findUnique({ where: { email } });
  if (emailFree) return { error: "No se pudo crear la cuenta participante (email en uso)." };

  const passwordHash = await hashParticipantPassword(documentId);
  const user = await prisma.user.create({
    data: {
      name: opts.name.trim(),
      email,
      documentId,
      passwordHash,
      role: "PARTICIPANT",
    },
  });
  return { ok: true, userId: user.id };
}
