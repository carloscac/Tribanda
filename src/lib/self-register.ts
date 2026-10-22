import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session-user";

export function canSelfInscribe(tournament: { status: string; groupsFinalized?: boolean }) {
  return tournament.status !== "CLOSED";
}

export function isStrongEnoughPassword(raw: string) {
  return raw.length >= 6 && raw.length <= 72;
}

export function tournamentRequiresPayment(entryFee: number | null | undefined) {
  return entryFee != null && entryFee > 0;
}

export type PlayerCategoryHint = {
  categoryId: string | null;
  handicap: number | null;
  categoryName: string | null;
  categoryDistance: number | null;
};

export type SingleCategory = { id: string; name: string; distance: number };

export function normalizeCategoryKey(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function playerHasKnownCategory(
  player: PlayerCategoryHint | null,
): player is PlayerCategoryHint {
  if (!player) return false;
  return Boolean(
    player.categoryId ||
      player.categoryName ||
      player.categoryDistance != null ||
      player.handicap != null,
  );
}

export function playerMatchesSingleCategory(player: PlayerCategoryHint, single: SingleCategory) {
  if (player.categoryId === single.id) return true;
  if (
    player.categoryName &&
    normalizeCategoryKey(player.categoryName) === normalizeCategoryKey(single.name)
  ) {
    return true;
  }
  if (player.categoryDistance != null && player.categoryDistance === single.distance) return true;
  if (player.handicap != null && player.handicap === single.distance) return true;
  return false;
}

export function matchOrganizerCategory(
  categories: SingleCategory[],
  player: PlayerCategoryHint | null,
) {
  if (!playerHasKnownCategory(player)) return null;
  return (
    categories.find((row) => row.id === player.categoryId) ??
    categories.find(
      (row) =>
        player.categoryName &&
        normalizeCategoryKey(row.name) === normalizeCategoryKey(player.categoryName),
    ) ??
    categories.find((row) => player.categoryDistance != null && row.distance === player.categoryDistance) ??
    categories.find((row) => player.handicap != null && row.distance === player.handicap) ??
    null
  );
}

export function canPlayerSelfJoin(
  tournament: { mix: string; status: string; groupsFinalized: boolean },
  single: SingleCategory | null,
  player: PlayerCategoryHint | null,
): { allowed: boolean; reason: "ok" | "closed" | "category" } {
  if (!canSelfInscribe(tournament)) return { allowed: false, reason: "closed" };
  if (tournament.mix !== "SINGLE" || !single) return { allowed: true, reason: "ok" };
  if (!playerHasKnownCategory(player)) return { allowed: true, reason: "ok" };
  if (playerMatchesSingleCategory(player, single)) return { allowed: true, reason: "ok" };
  return { allowed: false, reason: "category" };
}

export function categoryMismatchMessage(single: SingleCategory | null) {
  const name = single?.name ?? "esta categoría";
  return `Este torneo es de ${name}. Tu categoría no coincide; el organizador debe inscribirte.`;
}

export async function findParticipantInscription(
  tournamentId: string,
  participant: { id: string; documentId?: string | null } | null,
) {
  if (!participant) return null;
  return prisma.inscription.findFirst({
    where: {
      tournamentId,
      OR: [
        { participantUserId: participant.id },
        ...(participant.documentId ? [{ player: { documentId: participant.documentId } }] : []),
      ],
    },
    select: { id: true, paid: true, playerId: true },
  });
}

export async function loadPlayerCategoryHint(
  participant: { id: string; documentId?: string | null } | null,
): Promise<PlayerCategoryHint | null> {
  if (!participant) return null;
  const player = await prisma.player.findFirst({
    where: participant.documentId
      ? { documentId: participant.documentId }
      : { inscriptions: { some: { participantUserId: participant.id } } },
    select: {
      categoryId: true,
      handicap: true,
      category: { select: { name: true, distance: true } },
    },
  });
  if (!player) return null;
  return {
    categoryId: player.categoryId,
    handicap: player.handicap,
    categoryName: player.category?.name ?? null,
    categoryDistance: player.category?.distance ?? null,
  };
}

export async function loadSingleCategory(id: string | null | undefined) {
  if (!id) return null;
  return prisma.category.findUnique({
    where: { id },
    select: { id: true, name: true, distance: true },
  });
}

export async function loadPublicJoinState(
  tournament: {
    id: string;
    mix: string;
    singleCategoryId: string | null;
    status: string;
    groupsFinalized: boolean;
  },
  session: SessionUser | null,
) {
  const participant = session?.role === "PARTICIPANT" ? session : null;
  const [inscription, playerHint, singleCategory] = await Promise.all([
    findParticipantInscription(tournament.id, participant),
    loadPlayerCategoryHint(participant),
    loadSingleCategory(tournament.singleCategoryId),
  ]);
  const join = canPlayerSelfJoin(tournament, singleCategory, playerHint);
  return {
    inscription,
    confirmed: Boolean(inscription?.paid),
    pendingPayment: Boolean(inscription && !inscription.paid),
    canSelfJoin: join.allowed && !inscription,
    blockedByCategory: join.reason === "category",
    singleCategory,
    playerHint,
  };
}
