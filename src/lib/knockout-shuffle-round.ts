import { shuffle } from "@/lib/groups";
import { prisma } from "@/lib/prisma";

/** Crea la siguiente ronda emparejando al azar a los ganadores (modo SHUFFLE_EACH). */
export async function maybeAdvanceShuffleKnockoutRound(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament || tournament.knockoutDrawMode !== "SHUFFLE_EACH") return;

  const openKo = await prisma.match.count({
    where: {
      tournamentId,
      phase: "KO",
      status: { in: ["SCHEDULED", "LIVE"] },
    },
  });
  if (openKo > 0) return;

  const lastRound = await prisma.match.findFirst({
    where: { tournamentId, phase: "KO" },
    orderBy: { round: "desc" },
    select: { round: true },
  });
  if (!lastRound) return;

  const round = lastRound.round;
  const finished = await prisma.match.findMany({
    where: {
      tournamentId,
      phase: "KO",
      round,
      status: { in: ["CLOSED", "WALKOVER"] },
      NOT: { closeReason: "bye" },
    },
    select: { winnerId: true, sideAId: true, sideBId: true, distanceA: true, distanceB: true },
  });

  const winners = finished.map((m) => ({
    id: m.winnerId!,
    distance:
      m.winnerId === m.sideAId ? m.distanceA : m.winnerId === m.sideBId ? m.distanceB : 12,
  }));

  if (winners.length < 2) return;
  if (winners.some((w) => !w.id)) return;

  const nextExists = await prisma.match.count({
    where: { tournamentId, phase: "KO", round: round + 1 },
  });
  if (nextExists > 0) return;

  const ordered = shuffle(winners);
  const matchCount = Math.floor(ordered.length / 2);
  for (let slot = 0; slot < matchCount; slot += 1) {
    const a = ordered[slot * 2];
    const b = ordered[slot * 2 + 1];
    await prisma.match.create({
      data: {
        tournamentId,
        phase: "KO",
        round: round + 1,
        bracketSlot: slot,
        sideAId: a.id,
        sideBId: b.id,
        distanceA: a.distance,
        distanceB: b.distance,
        status: "SCHEDULED",
      },
    });
  }
}
