import {
  FEATURED_FIRST_BYES,
  assignBracketSeeds,
  knockoutField,
  rankGroupMembers,
  type BracketPlayer,
} from "@/lib/bracket";
import { compareGroupStanding, parseGroupTiebreak, type GroupTiebreak } from "@/lib/group-standing";
import { readGroupTiebreak } from "@/lib/group-tiebreak-db";
import { readListRanks } from "@/lib/list-rank-db";
import { shuffle } from "@/lib/groups";
import { prisma } from "@/lib/prisma";

export const KNOCKOUT_FILL_MODES = ["AUTO", "PLAY_IN", "MANUAL"] as const;
export type KnockoutFillMode = (typeof KNOCKOUT_FILL_MODES)[number];

export const KNOCKOUT_DRAW_MODES = ["FIXED", "SHUFFLE_R1", "SHUFFLE_EACH"] as const;
export type KnockoutDrawMode = (typeof KNOCKOUT_DRAW_MODES)[number];

export function parseKnockoutFillMode(raw: string | null | undefined): KnockoutFillMode {
  if (raw === "PLAY_IN" || raw === "MANUAL") return raw;
  return "AUTO";
}

export function parseKnockoutDrawMode(raw: string | null | undefined): KnockoutDrawMode {
  if (raw === "SHUFFLE_R1" || raw === "SHUFFLE_EACH") return raw;
  return "FIXED";
}

export const FILL_MODE_LABEL: Record<KnockoutFillMode, string> = {
  AUTO: "Automático (mejores del ranking completan el cuadro)",
  PLAY_IN: "Ronda de ajuste (primeros pasan; últimos de la lista juegan)",
  MANUAL: "Manual (tú eliges quién entra al cuadro)",
};

export const DRAW_MODE_LABEL: Record<KnockoutDrawMode, string> = {
  FIXED: "Cuadro fijo (como está ahora)",
  SHUFFLE_R1: "Sorteo aleatorio solo en la 1ª ronda",
  SHUFFLE_EACH: "Sorteo aleatorio en cada ronda",
};

/** Sincroniza koEligible con quien clasificó en su grupo (no borra repesca/manual). */
export async function syncKoEligibleFromGroups(tournamentId: string) {
  const [groups, inscriptions, playInWins] = await Promise.all([
    prisma.group.findMany({
      where: { tournamentId },
      select: { members: { select: { inscriptionId: true, qualified: true } } },
    }),
    prisma.inscription.findMany({
      where: { tournamentId },
      select: { id: true, koEligible: true, koManualPick: true },
    }),
    prisma.match.findMany({
      where: {
        tournamentId,
        phase: "PLAY_IN",
        status: { in: ["CLOSED", "WALKOVER"] },
        winnerId: { not: null },
      },
      select: { winnerId: true },
    }),
  ]);

  const groupQualifiedIds = new Set<string>();
  for (const group of groups) {
    for (const member of group.members) {
      if (member.qualified) groupQualifiedIds.add(member.inscriptionId);
    }
  }
  const playInWinners = new Set(
    playInWins.map((match) => match.winnerId).filter((id): id is string => Boolean(id)),
  );

  const enable: string[] = [];
  const disable: string[] = [];
  for (const ins of inscriptions) {
    if (groupQualifiedIds.has(ins.id)) {
      if (!ins.koEligible) enable.push(ins.id);
      continue;
    }
    if (!playInWinners.has(ins.id) && !ins.koManualPick && ins.koEligible) {
      disable.push(ins.id);
    }
  }

  if (enable.length > 0) {
    await prisma.inscription.updateMany({
      where: { id: { in: enable } },
      data: { koEligible: true },
    });
  }
  if (disable.length > 0) {
    await prisma.inscription.updateMany({
      where: { id: { in: disable } },
      data: { koEligible: false },
    });
  }
}

export async function countGroupQualified(tournamentId: string) {
  return prisma.groupMember.count({
    where: { qualified: true, group: { tournamentId } },
  });
}

export async function countKoEligible(tournamentId: string) {
  return prisma.inscription.count({ where: { tournamentId, koEligible: true } });
}

type GroupMemberSeed = { seed: number | null; groupId?: string; qualified?: boolean };

/** @deprecated prefer isGroupElimineeForRepesca */
export function isGroupSecondForRepesca(groupMembers: GroupMemberSeed[]) {
  return groupMembers.some((gm) => gm.seed === 2);
}

/** No clasificó en su grupo (eliminado en fase de grupos). */
export function isGroupElimineeForRepesca(
  groupMembers: GroupMemberSeed[],
  groupsFinalized: boolean,
  fillMode: KnockoutFillMode,
) {
  return (
    fillMode === "PLAY_IN" &&
    groupsFinalized &&
    groupMembers.length > 0 &&
    groupMembers.every((gm) => gm.qualified !== true)
  );
}

/** Inscrito sin grupo tras cerrar fase de grupos (entra solo a repesca, no a un grupo). */
export function isExtraRepescaInscription(
  groupMembers: GroupMemberSeed[],
  groupsFinalized: boolean,
  fillMode: KnockoutFillMode,
) {
  return fillMode === "PLAY_IN" && groupsFinalized && groupMembers.length === 0;
}

export function canEnterRepesca(
  groupMembers: GroupMemberSeed[],
  groupsFinalized: boolean,
  fillMode: KnockoutFillMode,
) {
  return (
    isGroupElimineeForRepesca(groupMembers, groupsFinalized, fillMode) ||
    isExtraRepescaInscription(groupMembers, groupsFinalized, fillMode)
  );
}

export function isConfirmedRepescaParticipant(
  ins: {
    repescaOptIn: boolean | null;
    groupMembers: GroupMemberSeed[];
  },
  _repescaFee: number | null,
  groupsFinalized: boolean,
  fillMode: KnockoutFillMode,
) {
  if (ins.repescaOptIn !== true) return false;
  return canEnterRepesca(ins.groupMembers, groupsFinalized, fillMode);
}

export type PlayInCandidate = {
  id: string;
  name: string;
  groupName: string;
  tag: "repesca" | "sin_grupo";
  repescaOptIn: boolean | null;
  repescaFeePaid: boolean;
  koEligible: boolean;
};

export type QualifiedForPlayIn = {
  id: string;
  name: string;
  groupName: string;
  seed: number | null;
};

/** Inscritos con repesca confirmada (2.º de grupo o sin grupo en modo repesca). */
export function filterRepescaPool(
  inscriptions: {
    id: string;
    koEligible: boolean;
    repescaOptIn: boolean | null;
    repescaFeePaid: boolean;
    player: { name: string };
    groupMembers: { qualified: boolean; groupId: string; seed: number | null }[];
  }[],
  groupNameById: Map<string, string>,
  repescaFee: number | null,
  groupsFinalized: boolean,
  fillMode: KnockoutFillMode,
): PlayInCandidate[] {
  return inscriptions
    .filter((ins) =>
      isConfirmedRepescaParticipant(ins, repescaFee, groupsFinalized, fillMode),
    )
    .map((ins) => {
      const gm =
        ins.groupMembers.find((m) => !m.qualified) ?? ins.groupMembers[0] ?? null;
      const extra = ins.groupMembers.length === 0;
      return {
        id: ins.id,
        name: ins.player.name,
        groupName: extra
          ? "Sin grupo"
          : gm
            ? (groupNameById.get(gm.groupId) ?? "Grupo")
            : "Grupo",
        tag: extra ? ("sin_grupo" as const) : ("repesca" as const),
        repescaOptIn: ins.repescaOptIn,
        repescaFeePaid: ins.repescaFeePaid,
        koEligible: ins.koEligible,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Candidatos a repesca: 2.º de grupo e inscritos sin grupo (modo repesca). */
export function filterRepescaRoster(
  inscriptions: {
    id: string;
    koEligible: boolean;
    repescaOptIn: boolean | null;
    repescaFeePaid: boolean;
    player: { name: string };
    groupMembers: { qualified: boolean; groupId: string; seed: number | null }[];
  }[],
  groupNameById: Map<string, string>,
  groupsFinalized: boolean,
  fillMode: KnockoutFillMode,
) {
  return inscriptions
    .filter((ins) => canEnterRepesca(ins.groupMembers, groupsFinalized, fillMode))
    .map((ins) => {
      const gm =
        ins.groupMembers.find((m) => !m.qualified) ?? ins.groupMembers[0] ?? null;
      const extra = ins.groupMembers.length === 0;
      return {
        id: ins.id,
        name: ins.player.name,
        groupName: extra
          ? "Sin grupo"
          : gm
            ? (groupNameById.get(gm.groupId) ?? "Grupo")
            : "Grupo",
        repescaOptIn: ins.repescaOptIn,
        repescaFeePaid: ins.repescaFeePaid,
        bench: extra,
        seed: gm?.seed ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function filterRepescaDeclined(
  inscriptions: {
    id: string;
    koEligible: boolean;
    repescaOptIn: boolean | null;
    player: { name: string };
    groupMembers: { qualified: boolean; groupId: string; seed: number | null }[];
  }[],
  groupNameById: Map<string, string>,
) {
  return inscriptions
    .filter(
      (ins) =>
        isGroupSecondForRepesca(ins.groupMembers) &&
        ins.repescaOptIn === false,
    )
    .map((ins) => {
      const gm = ins.groupMembers[0];
      return {
        id: ins.id,
        name: ins.player.name,
        groupName: gm ? (groupNameById.get(gm.groupId) ?? "Grupo") : "—",
      };
    });
}

/** 2.º clasificado de grupo con plaza (puede perderla ante repesca). */
/** Inscritos sin plaza en el cuadro (pase directo del organizador). */
export function filterDirectPassCandidates(
  inscriptions: {
    id: string;
    koEligible: boolean;
    player: { name: string };
    groupMembers: { qualified: boolean; groupId: string; seed: number | null }[];
  }[],
  groupNameById: Map<string, string>,
) {
  return inscriptions
    .filter((ins) => !ins.koEligible && ins.groupMembers.every((m) => m.qualified !== true))
    .map((ins) => {
      const gm = ins.groupMembers.find((m) => m.qualified) ?? ins.groupMembers[0];
      let groupName = "Sin grupo";
      let note = "";
      if (gm) {
        groupName = groupNameById.get(gm.groupId) ?? "Grupo";
        if (gm.seed != null) note = `${gm.seed}.º`;
        else if (!gm.qualified) note = "Sin clasificar";
      }
      return {
        id: ins.id,
        name: ins.player.name,
        groupName,
        note,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function filterSecondQualifiedForPlayIn(
  inscriptions: Parameters<typeof filterQualifiedForPlayIn>[0],
  groupNameById: Map<string, string>,
): QualifiedForPlayIn[] {
  return filterQualifiedForPlayIn(inscriptions, groupNameById).filter((q) => q.seed === 2);
}

/** Clasificados de grupo (pueden jugar ronda de confirmación vs repesca). */
export function filterQualifiedForPlayIn(
  inscriptions: {
    id: string;
    koEligible: boolean;
    player: { name: string };
    groupMembers: { qualified: boolean; groupId: string; seed: number | null }[];
  }[],
  groupNameById: Map<string, string>,
): QualifiedForPlayIn[] {
  return inscriptions
    .filter((ins) => ins.groupMembers.some((gm) => gm.qualified))
    .map((ins) => {
      const gm = ins.groupMembers.find((m) => m.qualified)!;
      return {
        id: ins.id,
        name: ins.player.name,
        groupName: groupNameById.get(gm.groupId) ?? "Grupo",
        seed: gm.seed,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** @deprecated use filterRepescaPool */
export function filterPlayInCandidates(
  inscriptions: Parameters<typeof filterRepescaPool>[0],
  groupNameById: Map<string, string>,
): PlayInCandidate[] {
  return filterRepescaPool(inscriptions, groupNameById, null, true, "PLAY_IN");
}

export function rankedNonEligiblePool(
  groups: Parameters<typeof rankGroupMembers>[0] extends infer G ? G[] : never,
  koEligibleIds: Set<string>,
  mode: GroupTiebreak | string = "CAROMS",
) {
  const tiebreak = parseGroupTiebreak(mode);
  const ranked = groups.flatMap((group) => rankGroupMembers(group, tiebreak));
  return ranked
    .filter((row) => !koEligibleIds.has(row.inscriptionId))
    .sort((a, b) => compareGroupStanding(a, b, tiebreak));
}

/** El número del listado es la siembra del cuadro (1 arriba, 2 abajo, 3 al centro). */
async function applyListRanks(tournamentId: string, players: BracketPlayer[]) {
  const ranks = await readListRanks(tournamentId);
  if (ranks.size === 0) return players;
  return players.map((player) => {
    const overallRank = ranks.get(player.inscriptionId);
    return overallRank == null ? player : { ...player, overallRank };
  });
}

export async function buildKnockoutPlayerList(
  tournamentId: string,
  fillMode: KnockoutFillMode,
  bracketSize?: number,
): Promise<{ players: BracketPlayer[]; error?: string }> {
  const groups = await prisma.group.findMany({
    where: { tournamentId },
    include: {
      members: { include: { inscription: true } },
      matches: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  const mode = await readGroupTiebreak(tournamentId);

  if (fillMode === "AUTO") {
    const { players } = knockoutField(groups, bracketSize, mode);
    if (players.length < 2) return { players: [], error: "No hay suficientes jugadores." };
    return { players: assignBracketSeeds(await applyListRanks(tournamentId, players)) };
  }

  if (fillMode === "PLAY_IN") {
    const players = await buildPlayInBracketPlayers(groups, tournamentId, bracketSize, mode);
    if (players.length < 2) return { players: [], error: "No hay suficientes jugadores." };
    return { players: assignBracketSeeds(await applyListRanks(tournamentId, players)) };
  }

  const eligible = await prisma.inscription.findMany({
    where: { tournamentId, koEligible: true },
    include: { groupMembers: { include: { group: true } } },
  });

  if (bracketSize != null && eligible.length > bracketSize) {
    return {
      players: [],
      error: `Hay ${eligible.length} plazas ocupadas y el cuadro es de ${bracketSize}. Genera la ronda de ajuste o elige un cuadro más grande.`,
    };
  }

  const players: BracketPlayer[] = eligible.map((ins) => {
    const gm = ins.groupMembers[0];
    return {
      inscriptionId: ins.id,
      distance: ins.distance,
      groupId: gm?.groupId ?? "",
      groupSort: gm?.group.sortOrder ?? 0,
      seed: gm?.seed ?? 99,
    };
  });

  if (players.length < 2) return { players: [], error: "Muy pocos jugadores." };
  return { players: assignBracketSeeds(await applyListRanks(tournamentId, players)) };
}

async function buildPlayInBracketPlayers(
  groups: {
    id: string;
    sortOrder: number;
    members: {
      inscriptionId: string;
      qualified: boolean;
      seed: number | null;
      inscription: { distance: number };
    }[];
    matches: Parameters<typeof rankGroupMembers>[0]["matches"];
  }[],
  tournamentId: string,
  bracketSize?: number,
  mode: GroupTiebreak = "CAROMS",
): Promise<BracketPlayer[]> {
  const size = bracketSize && bracketSize >= 4 ? bracketSize : 32;
  const firsts: (BracketPlayer & {
    pg: number;
    caroms: number;
    innings: number;
    highRun: number;
  })[] = [];
  const others: BracketPlayer[] = [];
  const taken = new Set<string>();

  for (const group of groups) {
    const ranked = rankGroupMembers(
      {
        id: group.id,
        sortOrder: group.sortOrder,
        members: group.members.map((m) => ({
          inscriptionId: m.inscriptionId,
          qualified: m.qualified,
          inscription: { distance: m.inscription.distance },
        })),
        matches: group.matches,
      },
      mode,
    );
    for (const member of group.members) {
      if (!member.qualified) continue;
      const stats = ranked.find((row) => row.inscriptionId === member.inscriptionId);
      const player: BracketPlayer & {
        pg: number;
        caroms: number;
        innings: number;
        highRun: number;
      } = {
        inscriptionId: member.inscriptionId,
        distance: member.inscription.distance,
        groupId: group.id,
        groupSort: group.sortOrder,
        seed: member.seed ?? 99,
        pg: stats?.pg ?? 0,
        caroms: stats?.caroms ?? 0,
        innings: stats?.innings ?? 0,
        highRun: stats?.highRun ?? 0,
      };
      taken.add(member.inscriptionId);
      if (member.seed === 1) firsts.push(player);
      else others.push(player);
    }
  }

  firsts.sort((a, b) =>
    compareGroupStanding(
      {
        inscriptionId: a.inscriptionId,
        pg: a.pg,
        caroms: a.caroms,
        innings: a.innings,
        highRun: a.highRun,
        groupSort: a.groupSort,
      },
      {
        inscriptionId: b.inscriptionId,
        pg: b.pg,
        caroms: b.caroms,
        innings: b.innings,
        highRun: b.highRun,
        groupSort: b.groupSort,
      },
      mode,
    ),
  );
  firsts.forEach((row, index) => {
    row.overallRank = index + 1;
  });

  const players: BracketPlayer[] = [
    ...firsts.map(({ pg: _pg, caroms: _c, innings: _i, highRun: _h, ...row }) => row),
    ...others,
  ];

  const targetForThreeByes = Math.max(2, size - FEATURED_FIRST_BYES);
  if (players.length < targetForThreeByes) {
    const extras = await prisma.inscription.findMany({
      where: {
        tournamentId,
        repescaOptIn: true,
        id: { notIn: [...taken] },
      },
      include: { groupMembers: { include: { group: true } } },
      orderBy: { createdAt: "asc" },
    });
    for (const ins of extras) {
      if (players.length >= size) break;
      if (ins.groupMembers.some((m) => m.qualified)) continue;
      const gm = ins.groupMembers[0];
      players.push({
        inscriptionId: ins.id,
        distance: ins.distance,
        groupId: gm?.groupId ?? "",
        groupSort: gm?.group.sortOrder ?? 99,
        seed: 99,
        overallRank: 100,
      });
    }
  }

  return players;
}

export function shuffleBracketPlayers(players: BracketPlayer[]) {
  return shuffle([...players]);
}
