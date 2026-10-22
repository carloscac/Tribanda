import { roundTitle } from "@/lib/bracket";
import type { MatchBaseline, MatchStatus, Side, Visit } from "@/lib/arbitraje/domain/types";

type LoadedMatch = {
  id: string;
  tournamentId: string;
  phase: string;
  round: number;
  status: string;
  paused: boolean;
  closeReason: string | null;
  winnerId: string | null;
  distanceA: number;
  distanceB: number;
  caromsA: number | null;
  caromsB: number | null;
  innings: number | null;
  highRunA: number | null;
  highRunB: number | null;
  liveStartedAt: Date | null;
  sideAId: string | null;
  sideBId: string | null;
  tableId: string | null;
  nextMatchId: string | null;
  nextSide: string | null;
  tournament: {
    name: string;
    userId: string;
    status: string;
    equalInnings: boolean;
    maxInnings: number | null;
    requireInnings: boolean;
  };
  table: { number: number } | null;
  group: { name: string } | null;
  sideA: { player: { name: string } } | null;
  sideB: { player: { name: string } } | null;
  visits: Array<{
    id: string;
    side: string;
    inning: number;
    caroms: number;
    endedAt: Date | null;
    createdAt: Date;
  }>;
};

export function phaseLabel(match: { phase: string; round: number; group: { name: string } | null }, koRounds: number) {
  if (match.phase === "GROUP") return match.group?.name ?? "Grupos";
  if (match.phase === "PLAY_IN") return "Repesca";
  return roundTitle(match.round, Math.max(koRounds, match.round || 1));
}

export function baselineFromMatch(match: LoadedMatch, pulledAt: string, koRounds: number): MatchBaseline {
  const visits: Visit[] = [...match.visits]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
    .map((visit) => ({
      id: visit.id,
      side: visit.side === "B" ? "B" : "A",
      inning: visit.inning,
      caroms: visit.caroms,
      endedAt: visit.endedAt ? visit.endedAt.toISOString() : null,
    }));
  const status = (match.status === "LIVE" || match.status === "CLOSED" || match.status === "WALKOVER"
    ? match.status
    : "SCHEDULED") as MatchStatus;
  const winnerSide: Side | null =
    match.winnerId && match.winnerId === match.sideAId ? "A" : match.winnerId === match.sideBId ? "B" : null;
  return {
    matchId: match.id,
    tournamentId: match.tournamentId,
    tournamentName: match.tournament.name,
    organizerId: match.tournament.userId,
    phaseLabel: phaseLabel(match, koRounds),
    groupName: match.group?.name ?? null,
    roundLabel: match.phase === "GROUP" ? null : phaseLabel(match, koRounds),
    tableNumber: match.table?.number ?? null,
    status,
    paused: match.paused,
    closeReason: match.closeReason,
    winnerSide,
    equalInnings: match.tournament.equalInnings,
    maxInnings: match.tournament.maxInnings,
    requireInnings: match.tournament.requireInnings,
    sideA: {
      inscriptionId: match.sideAId ?? "",
      name: match.sideA?.player.name ?? "Jugador A",
      distance: match.distanceA,
    },
    sideB: {
      inscriptionId: match.sideBId ?? "",
      name: match.sideB?.player.name ?? "Jugador B",
      distance: match.distanceB,
    },
    visits,
    liveStartedAt: match.liveStartedAt ? match.liveStartedAt.toISOString() : null,
    pulledAt,
    revision: "",
    timeConfig: { matchLimitMs: null, timeoutLimitMs: null },
  };
}

export const matchInclude = {
  tournament: {
    select: {
      name: true,
      userId: true,
      status: true,
      equalInnings: true,
      maxInnings: true,
      requireInnings: true,
    },
  },
  table: { select: { number: true } },
  group: { select: { name: true } },
  sideA: { select: { player: { select: { name: true } } } },
  sideB: { select: { player: { select: { name: true } } } },
  visits: true,
} as const;
