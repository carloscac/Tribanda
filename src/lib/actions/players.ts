"use server";

import { revalidatePath } from "next/cache";
import { isValidDocumentId, normalizeDocumentId } from "@/lib/document-id";
import { linkParticipantInscriptions } from "@/lib/participant-link";
import { provisionParticipantUser } from "@/lib/participant-account";
import { allocatePlayerCode } from "@/lib/player-code";
import { careerAverage } from "@/lib/player-label";
import { prisma } from "@/lib/prisma";
import { readImageFromForm } from "@/lib/tournament-image";
import { requireUserId } from "@/lib/session";
import { requireDataProcessingAttested } from "@/lib/data-processing";
import { requireOrganizerOrAdmin } from "@/lib/session-user";

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

async function findParticipantUser(documentId: string | null, email: string | null) {
  const doc = documentId ? normalizeDocumentId(documentId) : "";
  if (doc) {
    const byDoc = await prisma.user.findFirst({
      where: { documentId: doc, role: "PARTICIPANT", active: true },
      select: { id: true, documentId: true, email: true },
    });
    if (byDoc) return byDoc;
  }
  if (email) {
    return prisma.user.findFirst({
      where: { email: normalizeEmail(email), role: "PARTICIPANT", active: true },
      select: { id: true, documentId: true, email: true },
    });
  }
  return null;
}

async function syncPlayerParticipantLink(
  playerId: string,
  documentId: string | null,
  email: string | null,
) {
  const participant = await findParticipantUser(documentId, email);
  await prisma.inscription.updateMany({
    where: { playerId },
    data: { participantUserId: participant?.id ?? null },
  });
  if (participant) {
    await linkParticipantInscriptions(participant.id, {
      documentId,
      email,
    });
  }
}

async function savePlayerPhoto(
  playerId: string,
  photo: Awaited<ReturnType<typeof readImageFromForm>>,
) {
  if (photo.kind !== "set") return;
  const photoUrl = `/api/jugadores/${playerId}/foto?v=${Date.now()}`;
  await prisma.$executeRaw`
    UPDATE Player
    SET photoMime = ${photo.mime}, photoData = ${photo.data}, photoUrl = ${photoUrl}, updatedAt = CURRENT_TIMESTAMP(3)
    WHERE id = ${playerId}
  `;
}

function readDocumentId(formData: FormData) {
  const raw = String(formData.get("documentId") ?? "").trim();
  if (!raw) return null;
  if (!isValidDocumentId(raw)) return false as const;
  return normalizeDocumentId(raw);
}

export async function createPlayer(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  const alias = String(formData.get("alias") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const documentId = readDocumentId(formData);
  const emailRaw = String(formData.get("email") ?? "").trim();
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  const club = String(formData.get("club") ?? "").trim() || null;
  const photo = await readImageFromForm(formData, "photo");
  const categoryId = String(formData.get("categoryId") ?? "") || null;

  if (name.length < 2) return { error: "Escribe el nombre del jugador." };
  const attestError = requireDataProcessingAttested(formData);
  if (attestError) return attestError;
  if (documentId === false) return { error: "La cédula debe tener entre 5 y 15 dígitos." };
  if (email && !email.includes("@")) return { error: "Email del jugador no válido." };
  if (photo.kind === "error") return { error: photo.error };

  if (documentId) {
    const dup = await prisma.player.findFirst({
      where: { documentId },
    });
    if (dup) {
      return {
        error: `Ese deportista ya está registrado (${dup.code ?? "sin código"}). Inscríbelo desde el listado global.`,
      };
    }
  }

  if (categoryId) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) return { error: "Categoría no válida." };
  }

  if (documentId) {
    const provision = await provisionParticipantUser({ name, documentId, email });
    if ("error" in provision) return { error: provision.error };
  }

  const created = await prisma.player.create({
    data: {
      userId,
      code: await allocatePlayerCode(),
      name,
      alias,
      phone,
      documentId,
      email,
      club,
      categoryId,
    },
  });
  await savePlayerPhoto(created.id, photo);
  await syncPlayerParticipantLink(created.id, documentId, email);

  revalidatePath("/app/jugadores");
  return { ok: true };
}

export async function updatePlayer(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const userId = operator.id;
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const alias = String(formData.get("alias") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const documentId = readDocumentId(formData);
  const emailRaw = String(formData.get("email") ?? "").trim();
  const email = emailRaw ? normalizeEmail(emailRaw) : null;
  const club = String(formData.get("club") ?? "").trim() || null;
  const photo = await readImageFromForm(formData, "photo");
  const categoryId = String(formData.get("categoryId") ?? "") || null;

  if (!id || name.length < 2) return { error: "Datos incompletos." };
  if (documentId === false) return { error: "La cédula debe tener entre 5 y 15 dígitos." };
  if (email && !email.includes("@")) return { error: "Email del jugador no válido." };
  if (photo.kind === "error") return { error: photo.error };

  const player = await prisma.player.findFirst({ where: { id } });
  if (!player) return { error: "Jugador no encontrado." };
  if (player.userId !== userId && operator.role !== "ADMIN") {
    return { error: "Solo el club que lo dio de alta (o un admin) puede editar esta ficha." };
  }

  const nextDocumentId = player.documentId ?? documentId;
  if (player.documentId && documentId && documentId !== player.documentId) {
    return { error: "La cédula no se cambia. Identifica al deportista de forma permanente." };
  }

  if (nextDocumentId) {
    const dup = await prisma.player.findFirst({
      where: { documentId: nextDocumentId, NOT: { id } },
    });
    if (dup) {
      return {
        error: `Esa cédula ya pertenece a ${dup.name} (${dup.code ?? "sin código"}).`,
      };
    }
  }

  if (nextDocumentId) {
    const provision = await provisionParticipantUser({ name, documentId: nextDocumentId, email });
    if ("error" in provision) return { error: provision.error };
  }

  await prisma.player.update({
    where: { id },
    data: {
      name,
      alias,
      phone,
      documentId: nextDocumentId,
      email,
      club,
      categoryId,
    },
  });
  await savePlayerPhoto(id, photo);
  await syncPlayerParticipantLink(id, nextDocumentId, email);

  revalidatePath("/app/jugadores");
  revalidatePath(`/app/jugadores/${id}`);
  return { ok: true };
}

export async function updatePlayerHandicap(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const id = String(formData.get("id") ?? "");
  const next = Number(formData.get("handicap"));
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!id) return { error: "Jugador no encontrado." };
  if (!Number.isInteger(next) || next < 1 || next > 80) {
    return { error: "El handicap (distancia) debe ser entre 1 y 80." };
  }

  const player = await prisma.player.findFirst({
    where: { id },
    include: { tournamentRecords: { select: { isChampion: true, caroms: true, innings: true } } },
  });
  if (!player) return { error: "Jugador no encontrado." };
  if (player.userId !== operator.id && operator.role !== "ADMIN") {
    return { error: "Solo el club que lo dio de alta (o un admin) puede cambiar el handicap." };
  }

  const championships = player.tournamentRecords.filter((row) => row.isChampion).length;
  const caroms = player.tournamentRecords.reduce((sum, row) => sum + row.caroms, 0);
  const innings = player.tournamentRecords.reduce((sum, row) => sum + row.innings, 0);

  await prisma.$transaction([
    prisma.player.update({ where: { id }, data: { handicap: next } }),
    prisma.playerHandicapChange.create({
      data: {
        playerId: id,
        previous: player.handicap,
        next,
        reason,
        championships,
        careerAverage: careerAverage(caroms, innings),
        changedByName: operator.name,
      },
    }),
  ]);

  revalidatePath("/app/jugadores");
  revalidatePath(`/app/jugadores/${id}`);
  return { ok: true };
}
