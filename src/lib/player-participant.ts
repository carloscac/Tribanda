import { isValidDocumentId, normalizeDocumentId } from "@/lib/document-id";
import { linkParticipantInscriptions } from "@/lib/participant-link";
import { provisionParticipantUser } from "@/lib/participant-account";
import { prisma } from "@/lib/prisma";

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export function readDocumentIdFromForm(formData: FormData, field = "documentId") {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) return null;
  if (!isValidDocumentId(raw)) return false as const;
  return normalizeDocumentId(raw);
}

async function syncPlayerParticipantLink(
  playerId: string,
  documentId: string | null,
  email: string | null,
) {
  let participantId: string | null = null;
  const doc = documentId ? normalizeDocumentId(documentId) : "";
  if (doc) {
    const byDoc = await prisma.user.findFirst({
      where: { documentId: doc, role: "PARTICIPANT", active: true },
      select: { id: true },
    });
    participantId = byDoc?.id ?? null;
  }
  if (!participantId && email) {
    const byEmail = await prisma.user.findFirst({
      where: { email: normalizeEmail(email), role: "PARTICIPANT", active: true },
      select: { id: true },
    });
    participantId = byEmail?.id ?? null;
  }

  await prisma.inscription.updateMany({
    where: { playerId },
    data: { participantUserId: participantId },
  });

  if (participantId) {
    await linkParticipantInscriptions(participantId, { documentId, email });
  }
}

/** Guarda cédula en el jugador, crea cuenta PARTICIPANT y vincula inscripciones. */
export async function attachParticipantAccess(opts: {
  userId: string;
  playerId: string;
  name: string;
  documentId: string;
  email?: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const documentId = normalizeDocumentId(opts.documentId);
  if (!isValidDocumentId(documentId)) {
    return { error: "La cédula debe tener entre 5 y 15 dígitos." };
  }

  const emailRaw = opts.email?.trim().toLowerCase() ?? "";
  const email = emailRaw && emailRaw.includes("@") ? emailRaw : null;
  if (emailRaw && !email) return { error: "Email del jugador no válido." };

  const dup = await prisma.player.findFirst({
    where: { userId: opts.userId, documentId, NOT: { id: opts.playerId } },
  });
  if (dup) return { error: "Ya tienes otro jugador con esa cédula." };

  const provision = await provisionParticipantUser({
    name: opts.name,
    documentId,
    email,
  });
  if ("error" in provision) return { error: provision.error };

  await prisma.player.update({
    where: { id: opts.playerId },
    data: {
      documentId,
      ...(email !== null ? { email } : {}),
    },
  });

  await syncPlayerParticipantLink(opts.playerId, documentId, email);
  return { ok: true };
}
