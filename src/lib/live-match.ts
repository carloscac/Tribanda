import { initials, matchPhaseLabel, playerAverage, type LiveMatchDTO, type LiveSide } from "@/lib/dashboard";
import { playerPhotoSrc } from "@/lib/player-photo";
import { prisma } from "@/lib/prisma";
import { isFinished } from "@/lib/scoring";
import { ownedMatchWhere } from "@/lib/tournament-access";
import type { UserRole } from "@/lib/roles";

const sideInclude = {
  include: { player: { omit: { photoData: true } }, category: true },
} as const;

function toSide(
  inscription: {
    id: string;
    distance: number;
    player: {
      id: string;
      name: string;
      club: string | null;
      photoUrl: string | null;
      updatedAt?: Date | string | null;
    };
    category: { name: string } | null;
  } | null,
  distance: number,
  caroms: number,
  serie: number,
  innings: number,
  highRun: number,
): LiveSide | null {
  if (!inscription) return null;
  return {
    inscriptionId: inscription.id,
    name: inscription.player.name,
    club: inscription.player.club,
    photoUrl: playerPhotoSrc(inscription.player),
    category: inscription.category?.name ?? null,
    distance,
    caroms,
    serie,
    average: playerAverage(caroms, Math.max(innings, 1)),
    highRun,
    initials: initials(inscription.player.name),
  };
}

export async function loadLiveMatch(
  matchId: string,
  userId: string,
  role: UserRole,
): Promise<LiveMatchDTO | null> {
  const match = await prisma.match.findFirst({
    where: ownedMatchWhere(matchId, userId, role),
    include: {
      tournament: { omit: { imageData: true } },
      table: true,
      group: true,
      visits: { orderBy: { createdAt: "asc" } },
      sideA: sideInclude,
      sideB: sideInclude,
      winner: { include: { player: { omit: { photoData: true } } } },
    },
  });
  if (!match || !match.table) return null;

  const koMax = await prisma.match.aggregate({
    where: { tournamentId: match.tournamentId, phase: "KO" },
    _max: { round: true },
  });

  const open = [...match.visits].reverse().find((v) => !v.endedAt);
  const innings = match.innings ?? 0;
  const caromsA = match.caromsA ?? 0;
  const caromsB = match.caromsB ?? 0;
  const highRunA = match.highRunA ?? 0;
  const highRunB = match.highRunB ?? 0;
  const maxInning = Math.max(innings, ...match.visits.map((v) => v.inning), 0);

  const history = Array.from({ length: maxInning }, (_, i) => {
    const inning = i + 1;
    return {
      inning,
      caromsA: match.visits.filter((v) => v.inning === inning && v.side === "A").reduce((s, v) => s + v.caroms, 0),
      caromsB: match.visits.filter((v) => v.inning === inning && v.side === "B").reduce((s, v) => s + v.caroms, 0),
      current: inning === maxInning,
    };
  });

  const averages = history.map((row) => {
    const cumA = history.filter((h) => h.inning <= row.inning).reduce((s, h) => s + h.caromsA, 0);
    const cumB = history.filter((h) => h.inning <= row.inning).reduce((s, h) => s + h.caromsB, 0);
    return {
      inning: row.inning,
      avgA: playerAverage(cumA, row.inning),
      avgB: playerAverage(cumB, row.inning),
    };
  });

  const tables = await prisma.table.findMany({
    where: { tournamentId: match.tournamentId },
    orderBy: { number: "asc" },
  });
  const liveOnTables = await prisma.match.findMany({
    where: { tournamentId: match.tournamentId, status: "LIVE" },
    include: {
      sideA: { include: { player: { select: { name: true } } } },
      sideB: { include: { player: { select: { name: true } } } },
      table: true,
    },
  });

  const recent = tables.map((table) => {
    const live = liveOnTables.find((m) => m.tableId === table.id);
    return {
      tableNumber: table.number,
      status: live ? (live.paused ? "Pausa" : "En juego") : "Libre",
      nameA: live?.sideA?.player.name ?? "—",
      nameB: live?.sideB?.player.name ?? "—",
      scoreA: live?.caromsA ?? null,
      scoreB: live?.caromsB ?? null,
      href: `/app/torneos/${match.tournamentId}/mesas/${table.number}`,
      highlight: table.id === match.tableId,
    };
  });

  return {
    matchId: match.id,
    tournamentId: match.tournamentId,
    tournamentName: match.tournament.name,
    venue: match.tournament.venue,
    tournamentStatus: match.tournament.status,
    tableNumber: match.table.number,
    phaseLabel: matchPhaseLabel(match, koMax._max.round ?? match.round),
    paused: match.paused,
    finished: isFinished(match.status),
    closeReason: match.closeReason,
    winnerName: match.winner?.player.name ?? null,
    equalInnings: match.tournament.equalInnings,
    maxInnings: match.tournament.maxInnings,
    innings,
    liveStartedAt: match.liveStartedAt?.toISOString() ?? null,
    currentSide: open?.side === "B" ? "B" : open?.side === "A" ? "A" : null,
    maxSerie: Math.max(highRunA, highRunB, 0),
    sideA: toSide(match.sideA, match.distanceA, caromsA, open?.side === "A" ? open.caroms : 0, innings, highRunA),
    sideB: toSide(match.sideB, match.distanceB, caromsB, open?.side === "B" ? open.caroms : 0, innings, highRunB),
    history,
    averages,
    recent,
  };
}

export async function findLiveMatchForUser(userId: string, tournamentId: string, role: UserRole) {
  const tournamentFilter =
    role === "ADMIN" ? { id: tournamentId } : { id: tournamentId, userId };
  return prisma.match.findFirst({
    where: { status: "LIVE", tournamentId, tournament: tournamentFilter, tableId: { not: null } },
    orderBy: { liveStartedAt: "desc" },
    select: { id: true, tournamentId: true },
  });
}
