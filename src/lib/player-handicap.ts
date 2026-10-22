import { careerAverage } from "@/lib/player-label";
import { prisma } from "@/lib/prisma";

/** Distancia con la que entra a un torneo: la suya, si ya tiene handicap. */
export function playingDistance(handicap: number | null | undefined, fallback: number) {
  if (handicap != null && Number.isInteger(handicap) && handicap >= 1 && handicap <= 80) {
    return handicap;
  }
  return fallback;
}

/** Deja el handicap del deportista igual a la distancia con la que jugó o quedó en un torneo. */
export async function rememberPlayerHandicap(input: {
  playerId: string;
  handicap: number;
  categoryId?: string | null;
  reason: string;
  changedByName: string;
}) {
  if (!Number.isInteger(input.handicap) || input.handicap < 1 || input.handicap > 80) return;

  const player = await prisma.player.findUnique({
    where: { id: input.playerId },
    select: {
      handicap: true,
      categoryId: true,
      tournamentRecords: { select: { isChampion: true, caroms: true, innings: true } },
    },
  });
  if (!player) return;

  let categoryId = input.categoryId;
  if (categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) categoryId = undefined;
  }

  const handicapChanged = player.handicap !== input.handicap;
  const categoryChanged = categoryId != null && categoryId !== player.categoryId;
  if (!handicapChanged && !categoryChanged) return;

  const championships = player.tournamentRecords.filter((row) => row.isChampion).length;
  const caroms = player.tournamentRecords.reduce((sum, row) => sum + row.caroms, 0);
  const innings = player.tournamentRecords.reduce((sum, row) => sum + row.innings, 0);

  await prisma.$transaction([
    prisma.player.update({
      where: { id: input.playerId },
      data: {
        ...(handicapChanged ? { handicap: input.handicap } : {}),
        ...(categoryChanged ? { categoryId } : {}),
      },
    }),
    ...(handicapChanged
      ? [
          prisma.playerHandicapChange.create({
            data: {
              playerId: input.playerId,
              previous: player.handicap,
              next: input.handicap,
              reason: input.reason,
              championships,
              careerAverage: careerAverage(caroms, innings),
              changedByName: input.changedByName,
            },
          }),
        ]
      : []),
  ]);
}
