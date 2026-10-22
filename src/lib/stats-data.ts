import { accumulatePlayerStats, compareStatsByTiebreak, pickLeaders, type TournamentOption } from "@/lib/stats";
import { loadTournamentGroupMeta, withGroupMeta } from "@/lib/stats-group-meta";
import { prisma } from "@/lib/prisma";
import { tournamentDetailWhere, tournamentListWhere } from "@/lib/tournament-access";
import type { UserRole } from "@/lib/roles";
import type { GroupTiebreak } from "@/lib/group-standing";

export async function loadPlayerStats(userId: string, role: UserRole, tournamentId: string) {
  const listed = await prisma.tournament.findMany({
    where: tournamentListWhere(userId, role),
    select: { id: true, name: true, slug: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const tournaments: TournamentOption[] = listed.map(({ id, name }) => ({ id, name }));
  const allowed = await prisma.tournament.findFirst({
    where: tournamentDetailWhere(tournamentId, userId, role),
    select: { id: true, name: true, slug: true },
  });
  const selected = allowed ?? listed.find((t) => t.id === tournamentId);

  const matches = selected
    ? await prisma.match.findMany({
    where: {
      tournamentId: selected.id,
      status: "CLOSED",
      NOT: { closeReason: "bye" },
    },
    include: {
      sideA: { include: { player: { omit: { photoData: true }, include: { category: true } } } },
      sideB: { include: { player: { omit: { photoData: true }, include: { category: true } } } },
    },
  })
    : [];

  const rawRows = accumulatePlayerStats(matches);
  const groupMatches = matches.filter((match) => match.phase === "GROUP");
  const rawGroupRows = accumulatePlayerStats(groupMatches);
  const meta = selected
    ? await loadTournamentGroupMeta(selected.id)
    : { mode: "CAROMS" as GroupTiebreak, members: [] };
  const decorate = (list: typeof rawRows) =>
    withGroupMeta(list, meta.members).sort((a, b) => compareStatsByTiebreak(a, b, meta.mode));
  return {
    tournaments,
    selectedId: selected?.id ?? null,
    selectedName: selected?.name ?? null,
    selectedSlug: selected?.slug ?? null,
    matchCount: matches.length,
    groupMatchCount: groupMatches.length,
    rows: decorate(rawRows),
    groupRows: decorate(rawGroupRows),
    leaders: pickLeaders(rawRows),
    groupTiebreak: meta.mode,
  };
}
