import {
  nextPowerOfTwo,
  pairFirstRound,
  type BracketPlayer,
  type KoMatchPlan,
} from "@/lib/bracket";
import { groupName, shuffle } from "@/lib/groups";
import type { KnockoutFillMode } from "@/lib/knockout-entry";
import { parseKnockoutDrawMode } from "@/lib/knockout-entry";

export const KNOCKOUT_FIRST_ROUND_PAIRINGS = [
  "CROSS_GROUP_SEED",
  "RANDOM",
  "RANDOM_RESPECT_SEEDS",
] as const;
export type KnockoutFirstRoundPairing = (typeof KNOCKOUT_FIRST_ROUND_PAIRINGS)[number];

export const FIRST_ROUND_PAIRING_LABEL: Record<KnockoutFirstRoundPairing, string> = {
  CROSS_GROUP_SEED:
    "Cruzado fijo (1.º de un grupo vs 2.º de otro, como sorteo olímpico)",
  RANDOM: "Aleatorio (sin priorizar 1.º vs 2.º)",
  RANDOM_RESPECT_SEEDS:
    "Aleatorio con criterio de puesto (1.º vs 2.º de distinto grupo cuando se pueda)",
};

export function parseKnockoutFirstRoundPairing(
  raw: string | null | undefined,
): KnockoutFirstRoundPairing {
  if (raw === "RANDOM" || raw === "RANDOM_RESPECT_SEEDS") return raw;
  return "CROSS_GROUP_SEED";
}

export function validatePredrawBracket(
  groupCount: number,
  qualifyPerGroup: number,
  fillMode: KnockoutFillMode,
): { ok: true; bracketSize: number } | { error: string } {
  if (fillMode !== "AUTO") {
    return {
      error:
        "El cuadro prefijado desde grupos solo funciona con «Plazas extra al cuadro: Automático». Cambia ese ajuste en el torneo o desactiva el cuadro prefijado.",
    };
  }
  if (groupCount < 2) {
    return { error: "Hacen falta al menos 2 grupos para armar un cuadro prefijado." };
  }
  const slots = groupCount * qualifyPerGroup;
  if (slots < 4) {
    return {
      error: `Solo hay ${slots} plazas de clasificación (${groupCount} grupos × ${qualifyPerGroup}). El cuadro necesita al menos 4.`,
    };
  }
  if ((slots & (slots - 1)) !== 0) {
    return {
      error: `${groupCount} grupos × ${qualifyPerGroup} clasificados = ${slots} plazas. El cuadro de eliminación debe ser 4, 8, 16, 32 o 64 (potencia de 2). Ajusta el número de grupos, el tamaño de grupo o cuántos clasifican por grupo.`,
    };
  }
  return { ok: true, bracketSize: slots };
}

export type GroupStub = { id: string; name: string; sortOrder: number };

function placeholderPlayers(groups: GroupStub[], qualifyPerGroup: number): BracketPlayer[] {
  const players: BracketPlayer[] = [];
  for (const g of groups) {
    for (let place = 1; place <= qualifyPerGroup; place += 1) {
      players.push({
        inscriptionId: `__predraw_${g.sortOrder}_${place}`,
        distance: 1,
        groupId: g.id,
        groupSort: g.sortOrder,
        seed: place,
      });
    }
  }
  return players;
}

function pairRandomFirstRound(players: BracketPlayer[]): (BracketPlayer | null)[] {
  const shuffled = shuffle([...players]);
  const size = shuffled.length;
  const matchCount = size / 2;
  const pairs: [BracketPlayer | null, BracketPlayer | null][] = Array.from(
    { length: matchCount },
    () => [null, null],
  );
  const used = new Set<string>();

  for (const player of shuffled) {
    if (used.has(player.inscriptionId)) continue;
    let placed = false;
    for (const pair of pairs) {
      const [a, b] = pair;
      if (a && !b && a.groupId !== player.groupId) {
        pair[1] = player;
        used.add(player.inscriptionId);
        placed = true;
        break;
      }
      if (!a && b && b.groupId !== player.groupId) {
        pair[0] = player;
        used.add(player.inscriptionId);
        placed = true;
        break;
      }
    }
    if (placed) continue;
    for (const pair of pairs) {
      if (!pair[0]) {
        pair[0] = player;
        used.add(player.inscriptionId);
        break;
      }
      if (!pair[1]) {
        pair[1] = player;
        used.add(player.inscriptionId);
        break;
      }
    }
  }
  return pairs.flat();
}

export function firstRoundSlots(
  groups: GroupStub[],
  qualifyPerGroup: number,
  pairing: KnockoutFirstRoundPairing,
  drawMode: string,
): (BracketPlayer | null)[] {
  let players = placeholderPlayers(groups, qualifyPerGroup);
  if (parseKnockoutDrawMode(drawMode) === "SHUFFLE_R1") {
    players = shuffle(players);
  }
  if (pairing === "RANDOM") {
    return pairRandomFirstRound(players);
  }
  return pairFirstRound(players);
}

export function predrawSlotLabel(
  groupOrder: number | null | undefined,
  place: number | null | undefined,
  groupNameByOrder: Map<number, string>,
) {
  if (groupOrder == null || place == null) return null;
  const gName = groupNameByOrder.get(groupOrder) ?? groupName(groupOrder);
  return `${place}.º ${gName}`;
}

function planKnockoutFromFirstRoundSlots(slots: (BracketPlayer | null)[]) {
  const filled = slots.filter((p): p is BracketPlayer => p != null);
  const size = nextPowerOfTwo(Math.max(filled.length, 2));
  while (slots.length < size) slots.push(null);
  const totalRounds = Math.log2(size);
  const plans: KoMatchPlan[] = [];

  for (let round = 1; round <= totalRounds; round += 1) {
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
  return { plans, size, totalRounds };
}

export function planPredrawKnockout(
  groups: GroupStub[],
  qualifyPerGroup: number,
  pairing: KnockoutFirstRoundPairing,
  drawMode: string,
) {
  const slots = firstRoundSlots(groups, qualifyPerGroup, pairing, drawMode);
  const { plans, size, totalRounds } = planKnockoutFromFirstRoundSlots(slots);
  return { plans, size, totalRounds, bracketSize: groups.length * qualifyPerGroup };
}

export function predrawSideMeta(player: BracketPlayer | null) {
  if (!player || player.inscriptionId.startsWith("__predraw_")) {
    return {
      groupOrder: player?.groupSort ?? null,
      place: player?.seed ?? null,
    };
  }
  return { groupOrder: player.groupSort ?? null, place: player.seed ?? null };
}

export function memberForPredrawSlot(
  members: { inscriptionId: string; qualified: boolean; seed: number | null }[],
  place: number,
) {
  const m = members.find((x) => x.qualified && x.seed === place);
  return m?.inscriptionId ?? null;
}
