import { rankGroupMembers } from "@/lib/bracket";
import {
  compareGroupStanding,
  parseGroupTiebreak,
  type GroupTiebreak,
} from "@/lib/group-standing";

export type AjusteTag = "primero" | "segundo" | "reencauche";

const TAG_RANK: Record<AjusteTag, number> = {
  primero: 0,
  segundo: 1,
  reencauche: 2,
};

export function ajusteTagLabel(tag: AjusteTag) {
  if (tag === "primero") return "1.º";
  if (tag === "segundo") return "2.º";
  return "reencauche";
}

export type AjusteCandidate = {
  inscriptionId: string;
  distance: number;
  name: string;
  groupName: string;
  tag: AjusteTag;
  pg: number;
  caroms: number;
  innings: number;
  highRun: number;
  groupSort: number;
};

export type AjusteMatch = {
  sideA: AjusteCandidate;
  sideB: AjusteCandidate;
};

export type AjustePlan = {
  bracketSize: number;
  firstCount: number;
  passFirsts: AjusteCandidate[];
  slotsRemaining: number;
  list: AjusteCandidate[];
  passDirect: AjusteCandidate[];
  play: AjusteCandidate[];
  matches: AjusteMatch[];
  rematchAvoided: boolean;
  byes: number;
};

export function compareAjusteCandidates(
  a: AjusteCandidate,
  b: AjusteCandidate,
  mode: GroupTiebreak = "CAROMS",
) {
  if (a.tag !== b.tag) return TAG_RANK[a.tag] - TAG_RANK[b.tag];
  return compareGroupStanding(a, b, mode);
}

export function playedPairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function collectPlayedPairs(
  matches: { sideAId: string | null; sideBId: string | null; status: string }[],
) {
  const played = new Set<string>();
  for (const match of matches) {
    if (!match.sideAId || !match.sideBId) continue;
    if (match.status !== "CLOSED" && match.status !== "WALKOVER" && match.status !== "LIVE") continue;
    played.add(playedPairKey(match.sideAId, match.sideBId));
  }
  return played;
}

function alreadyPlayed(
  a: { inscriptionId: string; groupName?: string },
  b: { inscriptionId: string; groupName?: string },
  played: Set<string>,
) {
  if (played.has(playedPairKey(a.inscriptionId, b.inscriptionId))) return true;
  const groupA = a.groupName?.trim();
  const groupB = b.groupName?.trim();
  if (groupA && groupB && groupA !== "Sin grupo" && groupA === groupB) return true;
  return false;
}

/** 1.º vs último, 2.º vs penúltimo… sobre quienes sí juegan el ajuste. */
export function pairFirstVsLast<T>(players: T[]): { sideA: T; sideB: T }[] {
  const matches: { sideA: T; sideB: T }[] = [];
  let left = 0;
  let right = players.length - 1;
  while (left < right) {
    matches.push({ sideA: players[left], sideB: players[right] });
    left += 1;
    right -= 1;
  }
  return matches;
}

/** Primero vs último, pero cambia el rival si ya se enfrentaron (mismo grupo o partido previo). */
export function pairFirstVsLastAvoidingRematches<T extends { inscriptionId: string; groupName?: string }>(
  players: T[],
  played: Set<string> = new Set(),
): { pairs: { sideA: T; sideB: T }[]; rematchAvoided: boolean } {
  const defaultPairs = pairFirstVsLast(players);
  if (defaultPairs.length === 0) return { pairs: defaultPairs, rematchAvoided: false };

  const half = Math.floor(players.length / 2);
  const left = players.slice(0, half);
  const rightDefault = players.slice(half).reverse();

  const rematchCount = (right: T[]) =>
    left.reduce((sum, a, i) => sum + (alreadyPlayed(a, right[i], played) ? 1 : 0), 0);

  let best = rightDefault;
  let bestScore = rematchCount(rightDefault);

  for (let rot = 1; rot < rightDefault.length && bestScore > 0; rot += 1) {
    const candidate = [...rightDefault.slice(rot), ...rightDefault.slice(0, rot)];
    const score = rematchCount(candidate);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  if (bestScore > 0) {
    const order = [...best];
    for (let i = 0; i < order.length; i += 1) {
      if (!alreadyPlayed(left[i], order[i], played)) continue;
      for (let j = 0; j < order.length; j += 1) {
        if (i === j) continue;
        const before =
          (alreadyPlayed(left[i], order[i], played) ? 1 : 0) +
          (alreadyPlayed(left[j], order[j], played) ? 1 : 0);
        const after =
          (alreadyPlayed(left[i], order[j], played) ? 1 : 0) +
          (alreadyPlayed(left[j], order[i], played) ? 1 : 0);
        if (after < before) {
          const swap = order[i];
          order[i] = order[j];
          order[j] = swap;
          break;
        }
      }
    }
    best = order;
    bestScore = rematchCount(best);
  }

  const pairs = left.map((sideA, i) => ({ sideA, sideB: best[i] }));
  const rematchAvoided = pairs.some(
    (pair, i) =>
      pair.sideA.inscriptionId !== defaultPairs[i]?.sideA.inscriptionId ||
      pair.sideB.inscriptionId !== defaultPairs[i]?.sideB.inscriptionId,
  );
  return { pairs, rematchAvoided };
}

export function collectAjustePools(opts: {
  groups: {
    name: string;
    sortOrder?: number;
    members: {
      inscriptionId: string;
      qualified: boolean;
      seed: number | null;
      inscription: { distance: number; player: { name: string } };
    }[];
    matches: {
      status: string;
      winnerId: string | null;
      sideAId: string | null;
      sideBId: string | null;
      caromsA: number | null;
      caromsB: number | null;
      highRunA: number | null;
      highRunB: number | null;
      innings?: number | null;
    }[];
  }[];
  reencauchadoIds: Set<string>;
  extraReencauchados?: {
    inscriptionId: string;
    distance: number;
    name: string;
  }[];
  groupTiebreak?: GroupTiebreak | string;
}): { firsts: AjusteCandidate[]; seconds: AjusteCandidate[]; reencauchados: AjusteCandidate[] } {
  const mode = parseGroupTiebreak(opts.groupTiebreak);
  const firsts: AjusteCandidate[] = [];
  const seconds: AjusteCandidate[] = [];
  const taken = new Set<string>();

  for (const group of opts.groups) {
    const sortOrder = group.sortOrder ?? 0;
    const ranked = rankGroupMembers(
      {
        id: group.name,
        sortOrder,
        members: group.members.map((m) => ({
          inscriptionId: m.inscriptionId,
          qualified: m.qualified,
          inscription: { distance: m.inscription.distance },
        })),
        matches: group.matches,
      },
      mode,
    );
    const firstMember = group.members.find((m) => m.seed === 1) ?? null;
    const secondMember = group.members.find((m) => m.seed === 2) ?? null;
    const first = firstMember
      ? ranked.find((row) => row.inscriptionId === firstMember.inscriptionId) ?? ranked[0]
      : ranked[0];
    const second = secondMember
      ? ranked.find((row) => row.inscriptionId === secondMember.inscriptionId) ?? ranked[1]
      : ranked[1];
    if (first) {
      taken.add(first.inscriptionId);
      const ins = group.members.find((m) => m.inscriptionId === first.inscriptionId);
      firsts.push({
        inscriptionId: first.inscriptionId,
        distance: first.distance,
        name: ins?.inscription.player.name ?? "—",
        groupName: group.name,
        tag: "primero",
        pg: first.pg,
        caroms: first.caroms,
        innings: first.innings,
        highRun: first.highRun,
        groupSort: sortOrder,
      });
    }
    if (second && second.inscriptionId !== first?.inscriptionId) {
      taken.add(second.inscriptionId);
      const ins = group.members.find((m) => m.inscriptionId === second.inscriptionId);
      seconds.push({
        inscriptionId: second.inscriptionId,
        distance: second.distance,
        name: ins?.inscription.player.name ?? "—",
        groupName: group.name,
        tag: "segundo",
        pg: second.pg,
        caroms: second.caroms,
        innings: second.innings,
        highRun: second.highRun,
        groupSort: sortOrder,
      });
    }
  }

  const reencauchados: AjusteCandidate[] = [];
  for (const group of opts.groups) {
    for (const member of group.members) {
      if (taken.has(member.inscriptionId)) continue;
      if (!opts.reencauchadoIds.has(member.inscriptionId)) continue;
      const ranked = rankGroupMembers(
        {
          id: group.name,
          sortOrder: group.sortOrder ?? 0,
          members: group.members.map((m) => ({
            inscriptionId: m.inscriptionId,
            qualified: m.qualified,
            inscription: { distance: m.inscription.distance },
          })),
          matches: group.matches,
        },
        mode,
      ).find((row) => row.inscriptionId === member.inscriptionId);
      reencauchados.push({
        inscriptionId: member.inscriptionId,
        distance: member.inscription.distance,
        name: member.inscription.player.name,
        groupName: group.name,
        tag: "reencauche",
        pg: ranked?.pg ?? 0,
        caroms: ranked?.caroms ?? 0,
        innings: ranked?.innings ?? 0,
        highRun: ranked?.highRun ?? 0,
        groupSort: group.sortOrder ?? 0,
      });
      taken.add(member.inscriptionId);
    }
  }

  for (const extra of opts.extraReencauchados ?? []) {
    if (taken.has(extra.inscriptionId)) continue;
    reencauchados.push({
      inscriptionId: extra.inscriptionId,
      distance: extra.distance,
      name: extra.name,
      groupName: "Sin grupo",
      tag: "reencauche",
      pg: 0,
      caroms: 0,
      innings: 0,
      highRun: 0,
      groupSort: 99,
    });
  }

  return { firsts, seconds, reencauchados };
}

export function planRondaAjuste(opts: {
  bracketSize: number;
  firsts?: AjusteCandidate[];
  firstCount?: number;
  seconds: AjusteCandidate[];
  reencauchados: AjusteCandidate[];
  playedPairs?: Iterable<string>;
  groupTiebreak?: GroupTiebreak | string;
}): AjustePlan | { error: string } {
  const { bracketSize } = opts;
  if (!Number.isInteger(bracketSize) || bracketSize < 2 || (bracketSize & (bracketSize - 1)) !== 0) {
    return { error: "El cuadro debe ser 4, 8, 16, 32 o 64." };
  }

  const mode = parseGroupTiebreak(opts.groupTiebreak);
  const byStanding = (a: AjusteCandidate, b: AjusteCandidate) =>
    compareAjusteCandidates(a, b, mode);
  const passFirsts = [...(opts.firsts ?? [])].sort(byStanding);
  const seconds = [...opts.seconds].sort(byStanding);
  const plazaCount =
    passFirsts.length + seconds.length > 0
      ? passFirsts.length + seconds.length
      : Math.max(0, opts.firstCount ?? 0);
  const firstCount = plazaCount;

  if (firstCount > bracketSize) {
    return {
      error: `Hay ${firstCount} clasificados por grupo y el cuadro es de ${bracketSize}. Elige un cuadro más grande (32).`,
    };
  }

  const slotsRemaining = bracketSize - firstCount;
  const reencauchados = [...opts.reencauchados].sort(byStanding);
  let list = [...reencauchados];

  const empty = (extra: Partial<AjustePlan> = {}): AjustePlan => ({
    bracketSize,
    firstCount,
    passFirsts,
    slotsRemaining,
    list,
    passDirect: [],
    play: [],
    matches: [],
    rematchAvoided: false,
    byes: 0,
    ...extra,
  });

  if (slotsRemaining === 0) {
    return empty();
  }

  if (list.length > slotsRemaining * 2) {
    list = list.slice(0, slotsRemaining * 2);
  }

  if (list.length <= slotsRemaining) {
    return empty({
      passDirect: list,
      byes: slotsRemaining - list.length,
    });
  }

  const playCount = 2 * (list.length - slotsRemaining);
  const play = list.slice(list.length - playCount);
  const passDirect = list.slice(0, list.length - playCount);
  const played = new Set(opts.playedPairs ?? []);
  const { pairs, rematchAvoided } = pairFirstVsLastAvoidingRematches(play, played);

  return empty({
    passDirect,
    play,
    matches: pairs,
    rematchAvoided,
  });
}
