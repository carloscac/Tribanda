import { cache } from "react";
import { notFound } from "next/navigation";
import { matchPhaseLabel, playerAverage } from "@/lib/dashboard";
import { STATUS_LABEL } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import {
  defaultParticipantScreens,
  parseParticipantScreens,
  type ParticipantScreens,
} from "@/lib/participant-screens";
import { predrawSlotLabel } from "@/lib/bracket-predraw";
import { playerPhotoSrc } from "@/lib/player-photo";
import { canSelfInscribe } from "@/lib/self-register";
import { loadTournamentPayment, type TournamentPayment } from "@/lib/tournament-payment";
import { loadTournamentPhase, type TournamentPhase } from "@/lib/tournament-phase";
import { accumulatePlayerStats, compareStatsByTiebreak, pickLeaders, type StatsMatch, type StatsSide } from "@/lib/stats";
import { loadTournamentGroupMeta, withGroupMeta } from "@/lib/stats-group-meta";
import { compareGroupStanding } from "@/lib/group-standing";
import { readGroupTiebreak } from "@/lib/group-tiebreak-db";

const GROUP_STATUS: Record<string, string> = {
  OPEN: "En juego",
  TIE: "Empate — falta desempate",
  RESOLVED: "Clasificación lista",
};

export type PublicEvent = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  venue: string | null;
  dateLabel: string | null;
  status: string;
  statusLabel: string;
  qualifyPerGroup: number;
  equalInnings: boolean;
  knockoutLayout: string;
  participantScreens: ParticipantScreens;
  hasImage: boolean;
  imageUpdatedAt: string | null;
  registrationOpen: boolean;
  mix: string;
  singleCategoryId: string | null;
  singleCategoryName: string | null;
  entryFee: number | null;
  payment: TournamentPayment;
  currentPhase: TournamentPhase;
  groupsFinalized: boolean;
  plannedCapacity: number | null;
  registeredCount: number;
};

export type PublicMatchView = {
  id: string;
  phaseLabel: string;
  status: string;
  paused: boolean;
  closeReason: string | null;
  nameA: string | null;
  nameB: string | null;
  categoryA: string | null;
  categoryB: string | null;
  clubA: string | null;
  clubB: string | null;
  photoA: string | null;
  photoB: string | null;
  distanceA: number;
  distanceB: number;
  caromsA: number | null;
  caromsB: number | null;
  innings: number | null;
  highRunA: number | null;
  highRunB: number | null;
  winnerSide: "A" | "B" | null;
  tableNumber: number | null;
  round: number;
  bracketSlot: number | null;
};

export type PublicStanding = {
  inscriptionId: string;
  name: string;
  club: string | null;
  category: string | null;
  distance: number;
  played: number;
  won: number;
  caroms: number;
  innings: number;
  average: number | null;
  highRun: number;
  qualified: boolean;
};

export type PublicGroupView = {
  id: string;
  name: string;
  tableNumber: number | null;
  statusLabel: string;
  tiebreakLabel: string | null;
  played: number;
  total: number;
  standings: PublicStanding[];
  matches: PublicMatchView[];
};

export type PublicTableCard = {
  number: number;
  match: PublicMatchView | null;
};

type SideRow = {
  id: string;
  player: {
    id?: string;
    name: string;
    club: string | null;
    photoUrl?: string | null;
    category?: { name: string } | null;
  };
  category: { name: string } | null;
} | null;

type MatchRow = {
  id: string;
  phase: string;
  round: number;
  bracketSlot: number | null;
  status: string;
  paused: boolean;
  closeReason: string | null;
  distanceA: number;
  distanceB: number;
  caromsA: number | null;
  caromsB: number | null;
  innings: number | null;
  highRunA: number | null;
  highRunB: number | null;
  winnerId: string | null;
  sideAId: string | null;
  sideBId: string | null;
  sideA: SideRow;
  sideB: SideRow;
  sideAGroupOrder: number | null;
  sideAPlace: number | null;
  sideBGroupOrder: number | null;
  sideBPlace: number | null;
  table: { number: number } | null;
  group: { name: string } | null;
};

const sideInclude = {
  select: {
    id: true,
    player: { select: { id: true, name: true, club: true, photoUrl: true, updatedAt: true } },
    category: { select: { name: true } },
  },
} as const;

function tiebreakLabel(note: string | null) {
  if (!note) return null;
  if (note === "penaltis") return "Desempate por penaltis";
  if (note === "decision") return "Desempate por decisión del organizador";
  return note;
}

function winnerSide(winnerId: string | null, sideAId: string | null, sideBId: string | null) {
  if (!winnerId) return null;
  if (winnerId === sideAId) return "A" as const;
  if (winnerId === sideBId) return "B" as const;
  return null;
}

export function mapPublicMatch(
  match: MatchRow,
  totalKoRounds: number,
  groupNameByOrder?: Map<number, string>,
  withPhotos = false,
): PublicMatchView {
  const placeholderA =
    groupNameByOrder &&
    predrawSlotLabel(match.sideAGroupOrder, match.sideAPlace, groupNameByOrder);
  const placeholderB =
    groupNameByOrder &&
    predrawSlotLabel(match.sideBGroupOrder, match.sideBPlace, groupNameByOrder);
  return {
    id: match.id,
    phaseLabel: matchPhaseLabel(match, totalKoRounds),
    status: match.status,
    paused: match.paused,
    closeReason: match.closeReason,
    nameA:
      match.sideA?.player.name ??
      placeholderA ??
      (match.closeReason === "bye" && !match.sideAId ? "BYE" : null),
    nameB:
      match.sideB?.player.name ??
      placeholderB ??
      (match.closeReason === "bye" && !match.sideBId ? "BYE" : null),
    categoryA: match.sideA?.category?.name ?? null,
    categoryB: match.sideB?.category?.name ?? null,
    clubA: match.sideA?.player.club ?? null,
    clubB: match.sideB?.player.club ?? null,
    photoA:
      withPhotos && match.sideA?.player.id
        ? playerPhotoSrc({ ...match.sideA.player, id: match.sideA.player.id })
        : null,
    photoB:
      withPhotos && match.sideB?.player.id
        ? playerPhotoSrc({ ...match.sideB.player, id: match.sideB.player.id })
        : null,
    distanceA: match.distanceA,
    distanceB: match.distanceB,
    caromsA: match.caromsA,
    caromsB: match.caromsB,
    innings: match.innings,
    highRunA: match.highRunA,
    highRunB: match.highRunB,
    winnerSide: winnerSide(match.winnerId, match.sideAId, match.sideBId),
    tableNumber: match.table?.number ?? null,
    round: match.round,
    bracketSlot: match.bracketSlot,
  };
}

export function publicScoreLine(match: Pick<
  PublicMatchView,
  "status" | "paused" | "closeReason" | "caromsA" | "caromsB" | "innings" | "highRunA" | "highRunB"
>) {
  if (match.closeReason === "bye") return "BYE";
  if (match.status === "WALKOVER") return "W.O.";
  if (match.caromsA == null || match.caromsB == null) {
    if (match.status === "LIVE") return match.paused ? "En pausa" : "En mesa";
    if (match.status === "SCHEDULED") return "Pendiente";
    return "";
  }
  const tm =
    match.highRunA != null || match.highRunB != null
      ? ` · TM ${match.highRunA ?? "—"}/${match.highRunB ?? "—"}`
      : "";
  const ent = match.innings != null ? ` · ${match.innings} ent.` : "";
  return `${match.caromsA}–${match.caromsB}${ent}${tm}`;
}

export function publicPlayerLine(name: string | null, distance: number) {
  if (!name) return "Por definir";
  return `${name} (${distance})`;
}

export const requirePublicTournament = cache(async (slug: string): Promise<PublicEvent> => {
  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: {
      id: true,
      userId: true,
      name: true,
      slug: true,
      venue: true,
      date: true,
      status: true,
      qualifyPerGroup: true,
      equalInnings: true,
      knockoutLayout: true,
      participantScreens: true,
      imageMime: true,
      updatedAt: true,
      groupsFinalized: true,
      mix: true,
      singleCategoryId: true,
      entryFee: true,
      plannedCapacity: true,
      _count: { select: { inscriptions: true } },
    },
  });
  if (!tournament) notFound();
  const [payment, currentPhase] = await Promise.all([
    loadTournamentPayment(tournament.id),
    loadTournamentPhase(tournament.id, tournament.status, tournament.groupsFinalized),
  ]);
  const singleCategory =
    tournament.mix === "SINGLE" && tournament.singleCategoryId
      ? await prisma.category.findUnique({
          where: { id: tournament.singleCategoryId },
          select: { name: true },
        })
      : null;
  return {
    id: tournament.id,
    userId: tournament.userId,
    name: tournament.name,
    slug: tournament.slug,
    venue: tournament.venue,
    dateLabel: tournament.date
      ? tournament.date.toLocaleDateString("es-CO", { dateStyle: "medium" })
      : null,
    status: tournament.status,
    statusLabel: STATUS_LABEL[tournament.status] ?? tournament.status,
    qualifyPerGroup: tournament.qualifyPerGroup,
    equalInnings: tournament.equalInnings,
    knockoutLayout: tournament.knockoutLayout,
    participantScreens: tournament.participantScreens
      ? parseParticipantScreens(tournament.participantScreens)
      : defaultParticipantScreens(),
    hasImage: Boolean(tournament.imageMime),
    imageUpdatedAt: tournament.imageMime ? tournament.updatedAt.toISOString() : null,
    registrationOpen: canSelfInscribe(tournament),
    mix: tournament.mix,
    singleCategoryId: tournament.singleCategoryId,
    singleCategoryName: singleCategory?.name ?? null,
    entryFee: tournament.entryFee,
    payment,
    currentPhase,
    groupsFinalized: tournament.groupsFinalized,
    plannedCapacity: tournament.plannedCapacity,
    registeredCount: tournament._count.inscriptions,
  };
});

async function koRounds(tournamentId: string) {
  const koMax = await prisma.match.aggregate({
    where: { tournamentId, phase: "KO" },
    _max: { round: true },
  });
  return Math.max(koMax._max.round ?? 1, 1);
}

export async function loadPublicFloor(tournamentId: string) {
  const [tables, matches, totalKoRounds] = await Promise.all([
    prisma.table.findMany({
      where: { tournamentId },
      orderBy: { number: "asc" },
    }),
    prisma.match.findMany({
      where: {
        tournamentId,
        status: { in: ["LIVE", "SCHEDULED"] },
      },
      include: {
        sideA: sideInclude,
        sideB: sideInclude,
        table: { select: { id: true, number: true } },
        group: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    koRounds(tournamentId),
  ]);

  const liveByTable = new Map<string, PublicMatchView>();
  const queue: PublicMatchView[] = [];
  for (const match of matches) {
    const view = mapPublicMatch(match, totalKoRounds);
    if (match.status === "LIVE" && match.table) {
      liveByTable.set(match.table.id, view);
    } else if (match.status === "SCHEDULED" && match.sideAId && match.sideBId) {
      queue.push(view);
    }
  }

  return {
    tables: tables.map((table) => ({
      number: table.number,
      match: liveByTable.get(table.id) ?? null,
    })),
    queue,
  };
}

function standingFor(
  inscriptionId: string,
  distance: number,
  name: string,
  club: string | null,
  category: string | null,
  qualified: boolean,
  matches: MatchRow[],
): PublicStanding {
  let played = 0;
  let won = 0;
  let caroms = 0;
  let innings = 0;
  let highRun = 0;

  for (const match of matches) {
    if (match.closeReason === "bye") continue;
    const isA = match.sideAId === inscriptionId;
    const isB = match.sideBId === inscriptionId;
    if (!isA && !isB) continue;
    if (match.status === "CLOSED" || match.status === "WALKOVER") {
      played += 1;
      if (match.winnerId === inscriptionId) won += 1;
    }
    if (match.status === "WALKOVER") continue;
    if (match.status !== "CLOSED" && match.status !== "LIVE") continue;
    caroms += isA ? (match.caromsA ?? 0) : (match.caromsB ?? 0);
    highRun = Math.max(highRun, isA ? (match.highRunA ?? 0) : (match.highRunB ?? 0));
    if (match.innings != null && match.innings > 0) innings += match.innings;
  }

  return {
    inscriptionId,
    name,
    club,
    category,
    distance,
    played,
    won,
    caroms,
    innings,
    average: innings > 0 ? playerAverage(caroms, innings) : null,
    highRun,
    qualified,
  };
}

export async function loadPublicGroups(tournamentId: string): Promise<PublicGroupView[]> {
  const [groups, totalKoRounds, mode] = await Promise.all([
    prisma.group.findMany({
      where: { tournamentId },
      orderBy: { sortOrder: "asc" },
      include: {
        members: {
          include: {
            inscription: {
              include: {
                player: { select: { name: true, club: true } },
                category: { select: { name: true } },
              },
            },
          },
        },
        table: { select: { number: true } },
        matches: {
          include: {
            sideA: sideInclude,
            sideB: sideInclude,
            table: { select: { number: true } },
            group: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    koRounds(tournamentId),
    readGroupTiebreak(tournamentId),
  ]);

  return groups.map((group) => {
    const matches = group.matches;
    const finished = matches.filter(
      (match) =>
        match.closeReason !== "bye" && (match.status === "CLOSED" || match.status === "WALKOVER"),
    ).length;
    const standings = group.members
      .map((member) =>
        standingFor(
          member.inscriptionId,
          member.inscription.distance,
          member.inscription.player.name,
          member.inscription.player.club,
          member.inscription.category?.name ?? null,
          member.qualified,
          matches,
        ),
      )
      .sort((a, b) =>
        compareGroupStanding(
          {
            inscriptionId: a.inscriptionId,
            pg: a.won,
            caroms: a.caroms,
            innings: a.innings,
            highRun: a.highRun,
            groupSort: group.sortOrder,
          },
          {
            inscriptionId: b.inscriptionId,
            pg: b.won,
            caroms: b.caroms,
            innings: b.innings,
            highRun: b.highRun,
            groupSort: group.sortOrder,
          },
          mode,
        ),
      );

    return {
      id: group.id,
      name: group.name,
      tableNumber: group.table?.number ?? null,
      statusLabel: GROUP_STATUS[group.status] ?? group.status,
      tiebreakLabel: tiebreakLabel(group.tiebreakNote),
      played: finished,
      total: matches.length,
      standings,
      matches: matches.map((match) => mapPublicMatch(match, totalKoRounds)),
    };
  });
}

export async function loadPublicBracket(tournamentId: string) {
  const [matches, totalKoRounds, groups] = await Promise.all([
    prisma.match.findMany({
      where: { tournamentId, phase: "KO" },
      include: {
        sideA: sideInclude,
        sideB: sideInclude,
        table: { select: { number: true } },
        group: { select: { name: true } },
      },
      orderBy: [{ round: "asc" }, { bracketSlot: "asc" }],
    }),
    koRounds(tournamentId),
    prisma.group.findMany({
      where: { tournamentId },
      select: { name: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const groupNameByOrder = new Map(groups.map((g) => [g.sortOrder, g.name]));

  return {
    totalRounds: totalKoRounds,
    matches: matches.map((match) => mapPublicMatch(match, totalKoRounds, groupNameByOrder, true)),
  };
}

function toStatsSide(
  side: {
    id: string;
    player: { id: string; name: string; club: string | null; category: { name: string } | null };
  } | null,
): StatsSide | null {
  if (!side) return null;
  return {
    id: side.id,
    player: {
      id: side.player.id,
      name: side.player.name,
      club: side.player.club,
      category: side.player.category,
    },
  };
}

export async function loadPublicStats(tournamentId: string) {
  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      status: "CLOSED",
      NOT: { closeReason: "bye" },
    },
    include: {
      sideA: {
        include: {
          player: {
            select: { id: true, name: true, club: true, category: { select: { name: true } } },
          },
        },
      },
      sideB: {
        include: {
          player: {
            select: { id: true, name: true, club: true, category: { select: { name: true } } },
          },
        },
      },
    },
  });

  const counted: StatsMatch[] = matches.map((match) => ({
    status: match.status,
    closeReason: match.closeReason,
    winnerId: match.winnerId,
    caromsA: match.caromsA,
    caromsB: match.caromsB,
    innings: match.innings,
    highRunA: match.highRunA,
    highRunB: match.highRunB,
    sideA: toStatsSide(match.sideA),
    sideB: toStatsSide(match.sideB),
  }));
  const groupCounted: StatsMatch[] = matches
    .filter((match) => match.phase === "GROUP")
    .map((match) => ({
      status: match.status,
      closeReason: match.closeReason,
      winnerId: match.winnerId,
      caromsA: match.caromsA,
      caromsB: match.caromsB,
      innings: match.innings,
      highRunA: match.highRunA,
      highRunB: match.highRunB,
      sideA: toStatsSide(match.sideA),
      sideB: toStatsSide(match.sideB),
    }));
  const rawRows = accumulatePlayerStats(counted);
  const rawGroupRows = accumulatePlayerStats(groupCounted);
  const { mode, members } = await loadTournamentGroupMeta(tournamentId);
  const decorate = (list: typeof rawRows) =>
    withGroupMeta(list, members).sort((a, b) => compareStatsByTiebreak(a, b, mode));
  return {
    matchCount: counted.length,
    groupMatchCount: groupCounted.length,
    rows: decorate(rawRows),
    groupRows: decorate(rawGroupRows),
    leaders: pickLeaders(rawRows),
    groupTiebreak: mode,
  };
}

export function publicPhase(groups: { statusLabel: string }[], hasBracket: boolean) {
  if (groups.length === 0 && !hasBracket) return "wait" as const;
  const pending = groups.some((group) => group.statusLabel !== "Clasificación lista");
  if (groups.length > 0 && (pending || !hasBracket)) return "groups" as const;
  if (hasBracket) return "bracket" as const;
  return "wait" as const;
}
