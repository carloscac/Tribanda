import {
  compareGroupStanding,
  parseGroupTiebreak,
  type GroupTiebreak,
  type WinRow,
} from "@/lib/group-standing";

export { qualificationFromWins, type WinRow } from "@/lib/group-standing";

export function nextPowerOfTwo(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function roundTitle(round: number, totalRounds: number) {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinales";
  if (fromEnd === 2) return "Cuartos de final";
  if (fromEnd === 3) return "Octavos de final";
  if (fromEnd === 4) return "Dieciseisavos";
  return `Ronda ${round}`;
}

export type BracketPlayer = {
  inscriptionId: string;
  distance: number;
  groupId?: string;
  groupSort?: number;
  seed?: number;
  /** Siembra del cuadro: 1 es el mejor. Juega contra (tamaño + 1 - siembra); si no hay rival, es BYE. */
  overallRank?: number;
};

/** Siembra 1..N. Si hay listado, ese número manda; si no, se respeta el orden de clasificación. */
export function assignBracketSeeds(players: BracketPlayer[]): BracketPlayer[] {
  const hasRank = players.some((player) => player.overallRank != null);
  const ordered = hasRank
    ? [...players].sort((a, b) => (a.overallRank ?? 10000) - (b.overallRank ?? 10000))
    : players;
  return ordered.map((player, index) => ({ ...player, overallRank: index + 1 }));
}

/** Primeros de grupo que quedan vs BYE en el cuadro de 32 y pasan a 16. */
export const FEATURED_FIRST_BYES = 3;

export type GroupMatchStats = {
  sideAId: string | null;
  sideBId: string | null;
  winnerId: string | null;
  status: string;
  caromsA: number | null;
  caromsB: number | null;
  highRunA: number | null;
  highRunB: number | null;
  innings?: number | null;
};

export type RankedMember = {
  inscriptionId: string;
  groupId: string;
  groupSort: number;
  distance: number;
  qualified: boolean;
  seed: number;
  pg: number;
  caroms: number;
  innings: number;
  highRun: number;
};

function finished(status: string) {
  return status === "CLOSED" || status === "WALKOVER";
}

export function memberGroupStats(inscriptionId: string, matches: GroupMatchStats[]) {
  let pg = 0;
  let caroms = 0;
  let innings = 0;
  let highRun = 0;
  for (const match of matches) {
    const isA = match.sideAId === inscriptionId;
    const isB = match.sideBId === inscriptionId;
    if (!isA && !isB) continue;
    if (finished(match.status) && match.winnerId === inscriptionId) pg += 1;
    if (isA) {
      caroms += match.caromsA ?? 0;
      highRun = Math.max(highRun, match.highRunA ?? 0);
    } else {
      caroms += match.caromsB ?? 0;
      highRun = Math.max(highRun, match.highRunB ?? 0);
    }
    if (match.status === "CLOSED" && match.innings != null && match.innings > 0) {
      innings += match.innings;
    }
  }
  return { pg, caroms, innings, highRun };
}

export function compareRankedMembers(
  a: RankedMember,
  b: RankedMember,
  mode: GroupTiebreak = "CAROMS",
) {
  if (a.seed !== b.seed) return a.seed - b.seed;
  return compareGroupStanding(a, b, mode);
}

export function rankGroupMembers(
  group: {
    id: string;
    sortOrder: number;
    members: {
      inscriptionId: string;
      qualified: boolean;
      inscription: { distance: number };
    }[];
    matches: GroupMatchStats[];
  },
  mode: GroupTiebreak = "CAROMS",
): RankedMember[] {
  const ranked = group.members
    .map((member) => {
      const stats = memberGroupStats(member.inscriptionId, group.matches);
      return {
        inscriptionId: member.inscriptionId,
        groupId: group.id,
        groupSort: group.sortOrder,
        distance: member.inscription.distance,
        qualified: member.qualified,
        seed: 0,
        ...stats,
      };
    })
    .sort((a, b) => compareGroupStanding(a, b, mode));

  return ranked.map((row, index) => ({ ...row, seed: index + 1 }));
}

export function knockoutField(
  groups: {
    id: string;
    sortOrder: number;
    members: {
      inscriptionId: string;
      qualified: boolean;
      inscription: { distance: number };
    }[];
    matches: GroupMatchStats[];
  }[],
  targetSize?: number,
  mode: GroupTiebreak | string = "CAROMS",
): { players: BracketPlayer[]; extraIds: string[] } {
  const tiebreak = parseGroupTiebreak(mode);
  const ranked = groups.flatMap((group) => rankGroupMembers(group, tiebreak));
  const qualified = ranked
    .filter((row) => row.qualified)
    .sort((a, b) => compareRankedMembers(a, b, tiebreak));
  const remaining = ranked
    .filter((row) => !row.qualified)
    .sort((a, b) => compareRankedMembers(a, b, tiebreak));
  const autoTarget = nextPowerOfTwo(Math.max(qualified.length, 2));
  const target =
    targetSize != null && targetSize >= 2 && Number.isInteger(Math.log2(targetSize))
      ? targetSize
      : autoTarget;

  const pool = [...qualified, ...remaining];
  const toPlayer = (row: RankedMember): BracketPlayer => ({
    inscriptionId: row.inscriptionId,
    distance: row.distance,
    groupId: row.groupId,
    groupSort: row.groupSort,
    seed: row.seed,
  });
  if (pool.length < 2) {
    return { players: [], extraIds: [] };
  }

  const selected = pool.slice(0, Math.min(target, pool.length));
  const qualifiedIds = new Set(qualified.map((row) => row.inscriptionId));
  const extras = selected.filter((row) => !qualifiedIds.has(row.inscriptionId));

  return {
    players: selected.map(toPlayer),
    extraIds: extras.map((row) => row.inscriptionId),
  };
}

function emptyPairs(matchCount: number): [BracketPlayer | null, BracketPlayer | null][] {
  return Array.from({ length: matchCount }, () => [null, null]);
}

function putAvoidingGroup(
  pairs: [BracketPlayer | null, BracketPlayer | null][],
  player: BracketPlayer,
) {
  const groupId = player.groupId;
  for (const pair of pairs) {
    const [a, b] = pair;
    if (a && !b && a.groupId !== groupId) {
      pair[1] = player;
      return true;
    }
    if (!a && b && b.groupId !== groupId) {
      pair[0] = player;
      return true;
    }
  }
  for (const pair of pairs) {
    if (!pair[0] && !pair[1]) {
      pair[0] = player;
      return true;
    }
  }
  for (const pair of pairs) {
    if (!pair[0]) {
      pair[0] = player;
      return true;
    }
    if (!pair[1]) {
      pair[1] = player;
      return true;
    }
  }
  return false;
}

/** Cruces de 32 como el cuadro de referencia: 1 arriba, 3 al centro, 2 abajo. */
const SEEDED_PAIRS_32: [number, number][] = [
  [1, 32],
  [16, 17],
  [9, 24],
  [8, 25],
  [5, 28],
  [12, 21],
  [13, 20],
  [4, 29],
  [3, 30],
  [14, 19],
  [11, 22],
  [6, 27],
  [7, 26],
  [10, 23],
  [15, 18],
  [2, 31],
];

function seedOrder(size: number) {
  let slots = [1, 2];
  while (slots.length < size) {
    const next: number[] = [];
    const sum = slots.length * 2 + 1;
    for (const seed of slots) next.push(seed, sum - seed);
    slots = next;
  }
  return slots;
}

function seedPairs(size: number): [number, number][] {
  if (size === 32) return SEEDED_PAIRS_32;
  const slots = seedOrder(size);
  const pairs: [number, number][] = [];
  for (let i = 0; i < slots.length; i += 2) pairs.push([slots[i], slots[i + 1]]);
  return pairs;
}

function hasFullSeed(players: BracketPlayer[]) {
  if (players.length < 2) return false;
  const seeds = new Set<number>();
  for (const player of players) {
    const seed = player.overallRank;
    if (seed == null || !Number.isInteger(seed) || seed < 1) return false;
    if (seeds.has(seed)) return false;
    seeds.add(seed);
  }
  return true;
}

/** Ubica por número de lista para que los primeros no se crucen en la ronda siguiente. */
function placeSeededBracket(players: BracketPlayer[], size: number): (BracketPlayer | null)[] {
  const bySeed = new Map<number, BracketPlayer>();
  for (const player of players) {
    if (player.overallRank != null) bySeed.set(player.overallRank, player);
  }
  const flat: (BracketPlayer | null)[] = [];
  for (const [seedA, seedB] of seedPairs(size)) {
    flat.push(bySeed.get(seedA) ?? null, bySeed.get(seedB) ?? null);
  }
  return flat;
}

export function pairFirstRound(
  players: BracketPlayer[],
  targetSize?: number,
): (BracketPlayer | null)[] {
  const auto = nextPowerOfTwo(Math.max(players.length, 2));
  const size =
    targetSize != null && targetSize >= auto && Number.isInteger(Math.log2(targetSize))
      ? targetSize
      : auto;
  if (hasFullSeed(players)) return placeSeededBracket(players, size);
  const matchCount = size / 2;
  const pairs = emptyPairs(matchCount);
  const used = new Set<string>();

  const bySeed = (seed: number) =>
    players
      .filter((player) => (player.seed ?? 99) === seed)
      .sort((a, b) => (a.groupSort ?? 0) - (b.groupSort ?? 0));

  const winners = bySeed(1).sort(
    (a, b) => (a.overallRank ?? 99) - (b.overallRank ?? 99) || (a.groupSort ?? 0) - (b.groupSort ?? 0),
  );
  const seconds = bySeed(2);
  const byeCount = Math.max(0, size - players.length);
  const playPairs = byeCount > 0 ? pairs.slice(byeCount) : pairs;

  if (
    byeCount === 0 &&
    winners.length > 0 &&
    winners.length === seconds.length &&
    winners.length === matchCount
  ) {
    for (let i = 0; i < winners.length; i += 1) {
      const winner = winners[i];
      const second = seconds[(i + 1) % seconds.length];
      pairs[i][0] = winner;
      pairs[i][1] = second;
      used.add(winner.inscriptionId);
      used.add(second.inscriptionId);
    }
  } else {
    for (let i = 0; i < byeCount; i += 1) {
      const winner = winners[i];
      if (!winner) break;
      pairs[i][0] = winner;
      used.add(winner.inscriptionId);
    }
    winners
      .filter((winner) => !used.has(winner.inscriptionId))
      .forEach((winner, i) => {
        if (i >= playPairs.length) return;
        playPairs[i][0] = winner;
        used.add(winner.inscriptionId);
      });
    for (const second of seconds) {
      if (used.has(second.inscriptionId)) continue;
      putAvoidingGroup(playPairs, second);
      used.add(second.inscriptionId);
    }
  }

  for (const player of players) {
    if (used.has(player.inscriptionId)) continue;
    putAvoidingGroup(playPairs, player);
    used.add(player.inscriptionId);
  }

  return pairs.flat();
}

export function groupWinRows(
  memberIds: string[],
  matches: { winnerId: string | null; status: string }[],
): WinRow[] {
  return memberIds.map((inscriptionId) => ({
    inscriptionId,
    pg: matches.filter(
      (m) => (m.status === "CLOSED" || m.status === "WALKOVER") && m.winnerId === inscriptionId,
    ).length,
  }));
}

export type KoMatchPlan = {
  round: number;
  slot: number;
  nextRound: number | null;
  nextSlot: number | null;
  nextSide: "A" | "B" | null;
  sideA: BracketPlayer | null;
  sideB: BracketPlayer | null;
  isBye: boolean;
};

export function planKnockout(
  players: BracketPlayer[],
  opts?: { firstRoundOnly?: boolean; size?: number },
) {
  const auto = nextPowerOfTwo(Math.max(players.length, 2));
  const size =
    opts?.size != null && opts.size >= auto && Number.isInteger(Math.log2(opts.size))
      ? opts.size
      : auto;
  const slots = pairFirstRound(players, size);
  const totalRounds = Math.log2(size);
  const lastRound = opts?.firstRoundOnly ? 1 : totalRounds;
  const plans: KoMatchPlan[] = [];

  for (let round = 1; round <= lastRound; round += 1) {
    const count = size / 2 ** round;
    for (let slot = 0; slot < count; slot += 1) {
      const last = round === totalRounds;
      const sideA = round === 1 ? slots[slot * 2] : null;
      const sideB = round === 1 ? slots[slot * 2 + 1] : null;
      plans.push({
        round,
        slot,
        nextRound: last ? null : round + 1,
        nextSlot: last ? null : Math.floor(slot / 2),
        nextSide: last ? null : slot % 2 === 0 ? "A" : "B",
        sideA,
        sideB,
        isBye: Boolean(sideA) !== Boolean(sideB),
      });
    }
  }

  return { size, totalRounds, plans };
}
