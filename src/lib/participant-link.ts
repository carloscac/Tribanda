import { prisma } from "@/lib/prisma";
import { normalizeDocumentId } from "@/lib/document-id";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function linkParticipantInscriptions(
  userId: string,
  opts: { documentId?: string | null; email?: string | null },
) {
  const doc = opts.documentId ? normalizeDocumentId(opts.documentId) : "";
  const email = opts.email ? normalizeEmail(opts.email) : "";

  const playerIds = new Set<string>();

  if (doc) {
    const byDoc = await prisma.player.findMany({
      where: { documentId: doc },
      select: { id: true },
    });
    byDoc.forEach((p) => playerIds.add(p.id));
  }

  if (email.includes("@")) {
    const byEmail = await prisma.player.findMany({
      where: { email },
      select: { id: true },
    });
    byEmail.forEach((p) => playerIds.add(p.id));
  }

  if (playerIds.size === 0) return;

  await prisma.inscription.updateMany({
    where: { playerId: { in: [...playerIds] } },
    data: { participantUserId: userId },
  });
}
