import { prisma } from "@/lib/prisma";
import { playerAverage } from "@/lib/dashboard";
import { accumulatePlayerStats } from "@/lib/stats";
import { knockoutPrizePlaces } from "@/lib/standing";

export async function snapshotTournamentRecords(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      inscriptions: { select: { id: true, playerId: true } },
      matches: {
        include: {
          sideA: {
            include: {
              player: { include: { category: { select: { name: true } } } },
            },
          },
          sideB: {
            include: {
              player: { include: { category: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
  if (!tournament) return;

  const stats = accumulatePlayerStats(tournament.matches);
  const byPlayer = new Map(stats.map((row) => [row.playerId, row]));
  const places = knockoutPrizePlaces(tournament.matches, 8);
  const placeByInscription = new Map(places.entries());
  const inscriptionToPlayer = new Map(
    tournament.inscriptions.map((row) => [row.id, row.playerId]),
  );
  const placeByPlayer = new Map<string, number>();
  for (const [inscriptionId, place] of placeByInscription) {
    const playerId = inscriptionToPlayer.get(inscriptionId);
    if (playerId && !placeByPlayer.has(playerId)) placeByPlayer.set(playerId, place);
  }

  for (const inscription of tournament.inscriptions) {
    const row = byPlayer.get(inscription.playerId);
    const place = placeByPlayer.get(inscription.playerId) ?? null;
    const innings = row?.innings ?? 0;
    await prisma.playerTournamentRecord.upsert({
      where: {
        playerId_tournamentKey: {
          playerId: inscription.playerId,
          tournamentKey: tournament.id,
        },
      },
      create: {
        playerId: inscription.playerId,
        tournamentKey: tournament.id,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        tournamentSlug: tournament.slug,
        tournamentDate: tournament.date,
        venue: tournament.venue,
        place,
        isChampion: place === 1,
        played: row?.played ?? 0,
        won: row?.won ?? 0,
        lost: row?.lost ?? 0,
        caroms: row?.caroms ?? 0,
        innings,
        average: innings > 0 ? (row?.average ?? playerAverage(row?.caroms ?? 0, innings)) : null,
        highRun: row?.highRun ?? 0,
      },
      update: {
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        tournamentSlug: tournament.slug,
        tournamentDate: tournament.date,
        venue: tournament.venue,
        place,
        isChampion: place === 1,
        played: row?.played ?? 0,
        won: row?.won ?? 0,
        lost: row?.lost ?? 0,
        caroms: row?.caroms ?? 0,
        innings,
        average: innings > 0 ? (row?.average ?? playerAverage(row?.caroms ?? 0, innings)) : null,
        highRun: row?.highRun ?? 0,
      },
    });
  }

  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { historyCaptured: true },
  });
}

export async function ensureClosedTournamentHistory() {
  const pending = await prisma.tournament.findMany({
    where: { status: "CLOSED", historyCaptured: false },
    select: { id: true },
  });
  for (const row of pending) {
    await snapshotTournamentRecords(row.id);
  }
  return pending.length;
}
