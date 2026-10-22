import { prisma } from "@/lib/prisma";
import { readGroupTiebreak } from "@/lib/group-tiebreak-db";
import { readListRanks } from "@/lib/list-rank-db";
import type { GroupTiebreak } from "@/lib/group-standing";
import { applyGroupMeta, type GroupMeta, type PlayerStatRow } from "@/lib/stats";

export async function loadTournamentGroupMeta(tournamentId: string): Promise<{
  mode: GroupTiebreak;
  members: GroupMeta[];
}> {
  const [mode, inscriptions, ranks] = await Promise.all([
    readGroupTiebreak(tournamentId),
    prisma.inscription.findMany({
      where: { tournamentId },
      select: {
        id: true,
        playerId: true,
        groupMembers: {
          select: { group: { select: { name: true, sortOrder: true } } },
          take: 1,
        },
      },
    }),
    readListRanks(tournamentId),
  ]);

  const members: GroupMeta[] = [];
  for (const inscription of inscriptions) {
    const group = inscription.groupMembers[0]?.group;
    if (!group) continue;
    members.push({
      playerId: inscription.playerId,
      inscriptionId: inscription.id,
      groupName: group.name,
      groupSort: group.sortOrder,
      listRank: ranks.get(inscription.id) ?? null,
    });
  }

  return { mode, members };
}

export function withGroupMeta(rows: PlayerStatRow[], members: GroupMeta[]) {
  return applyGroupMeta(rows, members);
}
