import { roundRobinPairs } from "@/lib/groups";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export function groupRoundRobinRows(
  tournamentId: string,
  groupId: string,
  inscriptions: { id: string; distance: number }[],
) {
  if (inscriptions.length < 2) return [];
  return roundRobinPairs(inscriptions).map(([a, b]) => ({
    tournamentId,
    groupId,
    phase: "GROUP",
    sideAId: a.id,
    sideBId: b.id,
    distanceA: a.distance,
    distanceB: b.distance,
    status: "SCHEDULED",
  }));
}

export async function replaceGroupRoundRobin(
  tx: Tx,
  groupId: string,
  tournamentId: string,
  inscriptions: { id: string; distance: number }[],
) {
  const played = await tx.match.count({
    where: {
      groupId,
      status: { in: ["CLOSED", "WALKOVER", "LIVE"] },
      NOT: { closeReason: "bye" },
    },
  });
  if (played > 0) {
    return { error: "Este grupo ya tiene partidos en juego o cerrados." as const };
  }

  await tx.match.deleteMany({ where: { groupId, phase: "GROUP" } });

  const rows = groupRoundRobinRows(tournamentId, groupId, inscriptions);
  if (rows.length === 0) {
    return { ok: true as const, matches: 0 };
  }

  await tx.match.createMany({ data: rows });
  return { ok: true as const, matches: rows.length };
}

/** Suma partidos del recién llegado contra los que ya están, sin borrar resultados. */
export async function appendNewMemberMatches(
  tx: Tx,
  groupId: string,
  tournamentId: string,
  incoming: { id: string; distance: number },
  existing: { id: string; distance: number }[],
) {
  const others = existing.filter((row) => row.id !== incoming.id);
  if (others.length === 0) return { ok: true as const, matches: 0 };
  await tx.match.createMany({
    data: others.map((other) => ({
      tournamentId,
      groupId,
      phase: "GROUP",
      sideAId: incoming.id,
      sideBId: other.id,
      distanceA: incoming.distance,
      distanceB: other.distance,
      status: "SCHEDULED",
    })),
  });
  return { ok: true as const, matches: others.length };
}
