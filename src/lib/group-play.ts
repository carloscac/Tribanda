import { prisma } from "@/lib/prisma";

const PLAYED_STATUSES = ["LIVE", "CLOSED", "WALKOVER"] as const;

export async function inscriptionHasPlayed(inscriptionId: string, tournamentId: string) {
  const count = await prisma.match.count({
    where: {
      tournamentId,
      status: { in: [...PLAYED_STATUSES] },
      NOT: { closeReason: "bye" },
      OR: [{ sideAId: inscriptionId }, { sideBId: inscriptionId }],
    },
  });
  return count > 0;
}

export async function groupHasPlayedMatches(groupId: string) {
  const count = await prisma.match.count({
    where: {
      groupId,
      phase: "GROUP",
      status: { in: [...PLAYED_STATUSES] },
      NOT: { closeReason: "bye" },
    },
  });
  return count > 0;
}

export function playedInscriptionIdsFromMatches(
  matches: { status: string; closeReason: string | null; sideAId: string | null; sideBId: string | null }[],
) {
  const ids = new Set<string>();
  for (const match of matches) {
    if (!(PLAYED_STATUSES as readonly string[]).includes(match.status)) continue;
    if (match.closeReason === "bye") continue;
    if (match.sideAId) ids.add(match.sideAId);
    if (match.sideBId) ids.add(match.sideBId);
  }
  return ids;
}
