import Link from "next/link";
import { InscriptionManager } from "@/components/InscriptionManager";
import { PublicRefresh } from "@/components/public/PublicRefresh";
import { TournamentNavLoader } from "@/components/TournamentNavLoader";
import { getOrganizerTournamentContext } from "@/lib/load-organizer-tournament";
import { prisma } from "@/lib/prisma";
import { PrizePodium } from "@/components/PrizePodium";
import { knockoutPrizePlaces, standingsForInscriptions } from "@/lib/standing";

export default async function InscriptionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { ownerId } = await getOrganizerTournamentContext(id);
  const tournament = await prisma.tournament.findFirst({
    where: { id },
    omit: { imageData: true },
    include: { prizes: { orderBy: { place: "asc" } } },
  });
  if (!tournament) return null;

  const [inscriptions, categories, players, groupCount, groupedMembers, playedMatches, standingMatches] =
    await Promise.all([
    prisma.inscription.findMany({
      where: { tournamentId: id },
      include: { player: { omit: { photoData: true } }, category: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.category.findMany({
      where: { userId: ownerId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.player.findMany({
      omit: { photoData: true },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    prisma.group.count({ where: { tournamentId: id } }),
    prisma.groupMember.findMany({
      where: { group: { tournamentId: id } },
      select: {
        inscriptionId: true,
        qualified: true,
        group: { select: { status: true } },
      },
    }),
    prisma.match.findMany({
      where: {
        tournamentId: id,
        status: { in: ["LIVE", "CLOSED", "WALKOVER"] },
      },
      select: { sideAId: true, sideBId: true },
    }),
    prisma.match.findMany({
      where: { tournamentId: id },
      select: {
        phase: true,
        status: true,
        closeReason: true,
        sideAId: true,
        sideBId: true,
        winnerId: true,
        nextMatchId: true,
        round: true,
        caromsA: true,
        caromsB: true,
        distanceA: true,
        distanceB: true,
        highRunA: true,
        highRunB: true,
      },
    }),
  ]);

  const prizeSlots = Math.max(tournament.prizes.length, 1);
  const places = knockoutPrizePlaces(standingMatches, prizeSlots);
  const podium = [...places.entries()]
    .map(([inscriptionId, place]) => ({
      place,
      name: inscriptions.find((row) => row.id === inscriptionId)?.player.name ?? "—",
    }))
    .sort((a, b) => a.place - b.place);

  const standings = Object.fromEntries(
    standingsForInscriptions(
      inscriptions.map((row) => row.id),
      groupedMembers.map((member) => ({
        inscriptionId: member.inscriptionId,
        group: {
          settled: member.group.status === "RESOLVED",
          tie: member.group.status === "TIE",
          qualified: member.qualified,
        },
      })),
      standingMatches,
      prizeSlots,
    ),
  );

  const inscribedIds = new Set(inscriptions.map((i) => i.playerId));
  const availablePlayers = players.filter((p) => !inscribedIds.has(p.id));
  const groupedIds = groupedMembers.map((m) => m.inscriptionId);
  const lockedIds = [
    ...new Set(
      playedMatches.flatMap((m) => [m.sideAId, m.sideBId].filter((id): id is string => Boolean(id))),
    ),
  ];

  return (
    <main>
      <PublicRefresh intervalMs={5000} />
      <TournamentNavLoader id={id} current="inscritos" />
      <PrizePodium rows={podium} prizeSlots={prizeSlots} />
      {inscriptions.length === 0 && (
        <p className="mb-4 text-sm text-muted">
          Aún no hay inscritos. Cárgalos con Nuevo deportista o desde{" "}
          <Link className="font-semibold text-felt" href="/app/jugadores">
            Deportistas
          </Link>
          . Con 3 o más, arma los grupos en la pestaña Grupos.
        </p>
      )}
      <InscriptionManager
        tournament={tournament}
        inscriptions={inscriptions}
        categories={categories}
        availablePlayers={availablePlayers}
        hasGroups={groupCount > 0}
        groupedIds={groupedIds}
        lockedIds={lockedIds}
        standings={standings}
        prizes={tournament.prizes}
      />
    </main>
  );
}
