import { BracketBoard } from "@/components/BracketBoard";
import { getOrganizerTournamentContext } from "@/lib/load-organizer-tournament";
import { PrizePodium } from "@/components/PrizePodium";
import { TournamentNavLoader } from "@/components/TournamentNavLoader";
import { knockoutPrizePlaces } from "@/lib/standing";
import { prisma } from "@/lib/prisma";
import { syncGroupQualification } from "@/lib/qualification";

export default async function BracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getOrganizerTournamentContext(id);
  const tournament = await prisma.tournament.findFirst({
    where: { id },
    omit: { imageData: true },
    include: { prizes: true },
  });
  if (!tournament) return null;

  const openGroups = await prisma.group.count({
    where: { tournamentId: id, status: { not: "RESOLVED" } },
  });
  if (openGroups > 0) await syncGroupQualification(id);

  const [groups, matches, realKo] = await Promise.all([
    prisma.group.findMany({
      where: { tournamentId: id },
      select: {
        status: true,
        name: true,
        sortOrder: true,
        members: { select: { qualified: true } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.match.findMany({
      where: { tournamentId: id, phase: "KO" },
      select: {
        id: true,
        phase: true,
        round: true,
        bracketSlot: true,
        nextMatchId: true,
        status: true,
        closeReason: true,
        winnerId: true,
        sideAId: true,
        sideBId: true,
        caromsA: true,
        caromsB: true,
        distanceA: true,
        distanceB: true,
        innings: true,
        highRunA: true,
        highRunB: true,
        sideAGroupOrder: true,
        sideAPlace: true,
        sideBGroupOrder: true,
        sideBPlace: true,
        sideA: { select: { id: true, player: { select: { name: true, photoUrl: true } } } },
        sideB: { select: { id: true, player: { select: { name: true, photoUrl: true } } } },
      },
      orderBy: [{ round: "asc" }, { bracketSlot: "asc" }],
    }),
    prisma.match.count({
      where: {
        tournamentId: id,
        phase: "KO",
        OR: [
          { status: "LIVE" },
          { status: "WALKOVER" },
          { status: "CLOSED", closeReason: { not: "bye" } },
        ],
      },
    }),
  ]);

  const allResolved = groups.length > 0 && groups.every((g) => g.status === "RESOLVED");
  const groupNames = Object.fromEntries(groups.map((g) => [String(g.sortOrder), g.name]));
  const poolSize = groups.reduce((n, g) => n + g.members.length, 0);
  const qualifiedCount = groups.reduce(
    (n, g) => n + g.members.filter((m) => m.qualified).length,
    0,
  );
  const prizeSlots = Math.max(tournament.prizes.length, 1);
  const places = knockoutPrizePlaces(matches, prizeSlots);
  const names = new Map<string, string>();
  for (const match of matches) {
    if (match.sideA) names.set(match.sideA.id, match.sideA.player.name);
    if (match.sideB) names.set(match.sideB.id, match.sideB.player.name);
  }
  const podium = [...places.entries()]
    .map(([inscriptionId, place]) => ({ place, name: names.get(inscriptionId) ?? "—" }))
    .sort((a, b) => a.place - b.place);

  return (
    <main>
      <TournamentNavLoader id={id} current="cuadro" />
      <PrizePodium rows={podium} prizeSlots={prizeSlots} />
      <BracketBoard
        tournamentId={id}
        matches={matches}
        canGenerate={!tournament.knockoutPreDraw && allResolved && matches.length === 0}
        canRegenerate={
          !tournament.knockoutPreDraw && allResolved && matches.length > 0 && realKo === 0
        }
        requireInnings={tournament.requireInnings}
        knockoutLayout={tournament.knockoutLayout}
        qualifiedCount={qualifiedCount}
        poolSize={poolSize}
        knockoutPreDraw={tournament.knockoutPreDraw}
        groupNames={groupNames}
      />
    </main>
  );
}
