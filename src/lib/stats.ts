import { formatAverage, playerAverage } from "@/lib/dashboard";
import { compareGroupStanding, parseGroupTiebreak, type GroupTiebreak } from "@/lib/group-standing";

export type StatsMatch = {
  status: string;
  closeReason: string | null;
  winnerId: string | null;
  caromsA: number | null;
  caromsB: number | null;
  innings: number | null;
  highRunA: number | null;
  highRunB: number | null;
  sideA: StatsSide | null;
  sideB: StatsSide | null;
};

export type StatsSide = {
  id: string;
  player: {
    id: string;
    name: string;
    club: string | null;
    category: { name: string } | null;
  };
};

export type PlayerStatRow = {
  playerId: string;
  inscriptionId?: string;
  name: string;
  club: string | null;
  category: string | null;
  groupName?: string | null;
  groupSort?: number | null;
  listRank?: number | null;
  played: number;
  won: number;
  lost: number;
  caroms: number;
  innings: number;
  average: number | null;
  highRun: number;
};

export type GroupMeta = {
  playerId: string;
  inscriptionId: string;
  groupName: string;
  groupSort: number;
  listRank?: number | null;
};

export type StatsLeaders = {
  average: PlayerStatRow | null;
  highRun: PlayerStatRow | null;
  wins: PlayerStatRow | null;
};

export type TournamentOption = {
  id: string;
  name: string;
};

export function isCountedMatch(match: { status: string; closeReason: string | null }) {
  return match.status === "CLOSED" && match.closeReason !== "bye";
}

type Acc = PlayerStatRow & { averageCaroms: number };

function emptyRow(side: StatsSide): Acc {
  return {
    playerId: side.player.id,
    name: side.player.name,
    club: side.player.club,
    category: side.player.category?.name ?? null,
    played: 0,
    won: 0,
    lost: 0,
    caroms: 0,
    innings: 0,
    average: null,
    highRun: 0,
    averageCaroms: 0,
  };
}

function addSide(
  rows: Map<string, Acc>,
  side: StatsSide | null,
  caroms: number,
  highRun: number | null,
  innings: number | null,
  won: boolean,
) {
  if (!side) return;
  const current = rows.get(side.player.id) ?? emptyRow(side);
  current.played += 1;
  if (won) current.won += 1;
  else current.lost += 1;
  current.caroms += caroms;
  if (innings != null && innings > 0) {
    current.innings += innings;
    current.averageCaroms += caroms;
  }
  if (highRun != null && highRun > current.highRun) current.highRun = highRun;
  current.average = current.innings > 0 ? playerAverage(current.averageCaroms, current.innings) : null;
  rows.set(side.player.id, current);
}

export function accumulatePlayerStats(matches: StatsMatch[]): PlayerStatRow[] {
  const rows = new Map<string, Acc>();
  for (const match of matches) {
    if (!isCountedMatch(match)) continue;
    addSide(
      rows,
      match.sideA,
      match.caromsA ?? 0,
      match.highRunA,
      match.innings,
      match.winnerId === match.sideA?.id,
    );
    addSide(
      rows,
      match.sideB,
      match.caromsB ?? 0,
      match.highRunB,
      match.innings,
      match.winnerId === match.sideB?.id,
    );
  }
  return [...rows.values()]
    .map((entry) => {
      const { averageCaroms, ...row } = entry;
      void averageCaroms;
      return row;
    })
    .sort(comparePlayerStats);
}

export function applyGroupMeta(rows: PlayerStatRow[], members: GroupMeta[]): PlayerStatRow[] {
  const byPlayer = new Map(members.map((member) => [member.playerId, member]));
  return rows.map((row) => {
    const meta = byPlayer.get(row.playerId);
    if (!meta) return { ...row, groupSort: row.groupSort ?? 99 };
    return {
      ...row,
      inscriptionId: meta.inscriptionId,
      groupName: meta.groupName,
      groupSort: meta.groupSort,
      listRank: meta.listRank ?? null,
    };
  });
}

export function compareStatsByTiebreak(
  a: PlayerStatRow,
  b: PlayerStatRow,
  mode: GroupTiebreak | string,
) {
  const rankA = a.listRank;
  const rankB = b.listRank;
  if (rankA != null || rankB != null) {
    return (rankA ?? 999) - (rankB ?? 999);
  }
  return compareGroupStanding(
    {
      inscriptionId: a.inscriptionId ?? a.playerId,
      pg: a.won,
      caroms: a.caroms,
      innings: a.innings,
      highRun: a.highRun,
      groupSort: a.groupSort ?? 99,
    },
    {
      inscriptionId: b.inscriptionId ?? b.playerId,
      pg: b.won,
      caroms: b.caroms,
      innings: b.innings,
      highRun: b.highRun,
      groupSort: b.groupSort ?? 99,
    },
    parseGroupTiebreak(mode),
  );
}

export function comparePlayerStats(a: PlayerStatRow, b: PlayerStatRow) {
  const avgA = a.average ?? -1;
  const avgB = b.average ?? -1;
  if (avgB !== avgA) return avgB - avgA;
  if (b.won !== a.won) return b.won - a.won;
  if (b.highRun !== a.highRun) return b.highRun - a.highRun;
  if (b.played !== a.played) return b.played - a.played;
  return a.name.localeCompare(b.name, "es");
}

export function pickLeaders(rows: PlayerStatRow[]): StatsLeaders {
  const withAverage = rows.filter((row) => row.average != null && row.innings > 0);
  const average =
    withAverage.length === 0
      ? null
      : [...withAverage].sort((a, b) => {
          const diff = (b.average ?? 0) - (a.average ?? 0);
          if (diff !== 0) return diff;
          return b.innings - a.innings;
        })[0];

  const highRun =
    rows.reduce<PlayerStatRow | null>((best, row) => {
      if (row.highRun <= 0) return best;
      if (!best || row.highRun > best.highRun) return row;
      if (row.highRun === best.highRun && (row.average ?? 0) > (best.average ?? 0)) return row;
      return best;
    }, null);

  const wins =
    rows.reduce<PlayerStatRow | null>((best, row) => {
      if (row.won <= 0) return best;
      if (!best || row.won > best.won) return row;
      if (row.won === best.won && (row.average ?? 0) > (best.average ?? 0)) return row;
      return best;
    }, null);

  return { average, highRun, wins };
}

export function formatStatAverage(value: number | null) {
  if (value == null) return "—";
  return formatAverage(value);
}
