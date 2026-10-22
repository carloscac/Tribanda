import { roundTitle } from "@/lib/bracket";

export type LiveSide = {
  inscriptionId: string;
  name: string;
  club: string | null;
  photoUrl: string | null;
  category: string | null;
  distance: number;
  caroms: number;
  serie: number;
  average: number;
  highRun: number;
  initials: string;
};

export type HistoryRow = {
  inning: number;
  caromsA: number;
  caromsB: number;
  current: boolean;
};

export type AveragePoint = {
  inning: number;
  avgA: number;
  avgB: number;
};

export type RecentTable = {
  tableNumber: number;
  status: string;
  nameA: string;
  nameB: string;
  scoreA: number | null;
  scoreB: number | null;
  href: string;
  highlight: boolean;
};

export type LiveMatchDTO = {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  venue: string | null;
  tournamentStatus: string;
  tableNumber: number;
  phaseLabel: string;
  paused: boolean;
  finished: boolean;
  closeReason: string | null;
  winnerName: string | null;
  equalInnings: boolean;
  maxInnings: number | null;
  innings: number;
  liveStartedAt: string | null;
  currentSide: "A" | "B" | null;
  maxSerie: number;
  sideA: LiveSide | null;
  sideB: LiveSide | null;
  history: HistoryRow[];
  averages: AveragePoint[];
  recent: RecentTable[];
};

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

export function formatAverage(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0.000";
  return value.toFixed(3);
}

export function playerAverage(caroms: number, innings: number) {
  if (innings < 1) return 0;
  return caroms / innings;
}

export function matchPhaseLabel(
  match: { phase: string; round: number; group?: { name: string } | null },
  totalKoRounds: number,
) {
  if (match.phase === "GROUP") return match.group?.name ?? "Grupos";
  return roundTitle(match.round, Math.max(totalKoRounds, match.round || 1));
}

export function inningForNewVisit(last: { side: string; inning: number } | undefined, side: string) {
  if (!last) return 1;
  if (last.side === "A" && side === "B") return last.inning;
  if (last.side === "B" && side === "A") return last.inning + 1;
  return last.inning + 1;
}
