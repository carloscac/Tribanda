import { prisma } from "@/lib/prisma";
import { loadTournamentPhases, type TournamentPhase } from "@/lib/tournament-phase";
import { loadHiddenTournamentIds } from "@/lib/tournament-visibility";
import { STATUS_LABEL } from "@/lib/labels";
import {
  canPlayerSelfJoin,
  canSelfInscribe,
  loadPlayerCategoryHint,
  type PlayerCategoryHint,
  type SingleCategory,
} from "@/lib/self-register";

export const HISTORY_MONTHS_DEFAULT = 2;
export const HISTORY_MONTHS_MAX = 6;

export type HistoryMonths = typeof HISTORY_MONTHS_DEFAULT | typeof HISTORY_MONTHS_MAX;

export type CatalogTournament = {
  id: string;
  name: string;
  slug: string;
  venue: string | null;
  dateLabel: string | null;
  status: string;
  statusLabel: string;
  hasImage: boolean;
  imageUpdatedAt: string | null;
  inscriptionCount: number;
  plannedCapacity: number | null;
  registrationOpen: boolean;
  inscribed: boolean;
  pendingPayment: boolean;
  canSelfJoin: boolean;
  blockedByCategory: boolean;
  entryFee: number | null;
  mixLabel: string | null;
  currentPhase: TournamentPhase | null;
};

const catalogSelect = {
  id: true,
  name: true,
  slug: true,
  venue: true,
  date: true,
  status: true,
  groupsFinalized: true,
  imageMime: true,
  updatedAt: true,
  mix: true,
  singleCategoryId: true,
  entryFee: true,
  plannedCapacity: true,
  _count: { select: { inscriptions: true } },
} as const;

export function parseHistoryMonths(raw: string | undefined): HistoryMonths {
  return raw === String(HISTORY_MONTHS_MAX) ? HISTORY_MONTHS_MAX : HISTORY_MONTHS_DEFAULT;
}

export function historyCutoff(months: HistoryMonths) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return cutoff;
}

function toCatalog(
  row: {
    id: string;
    name: string;
    slug: string;
    venue: string | null;
    date: Date | null;
    status: string;
    groupsFinalized: boolean;
    imageMime: string | null;
    updatedAt: Date;
    mix: string;
    singleCategoryId: string | null;
    entryFee: number | null;
    plannedCapacity: number | null;
    _count: { inscriptions: number };
  },
  inscribed: Map<string, boolean>,
  playerHint: PlayerCategoryHint | null,
  singles: Map<string, SingleCategory>,
  phase: TournamentPhase | null,
): CatalogTournament {
  const when = row.date ?? row.updatedAt;
  const single = row.singleCategoryId ? (singles.get(row.singleCategoryId) ?? null) : null;
  const join = canPlayerSelfJoin(row, single, playerHint);
  const paid = inscribed.get(row.id);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    venue: row.venue,
    dateLabel: when.toLocaleDateString("es-CO", { dateStyle: "medium" }),
    status: row.status,
    statusLabel: STATUS_LABEL[row.status] ?? row.status,
    hasImage: Boolean(row.imageMime),
    imageUpdatedAt: row.imageMime ? row.updatedAt.toISOString() : null,
    inscriptionCount: row._count.inscriptions,
    plannedCapacity: row.plannedCapacity,
    registrationOpen: canSelfInscribe(row),
    inscribed: paid === true,
    pendingPayment: paid === false,
    canSelfJoin: join.allowed && paid === undefined,
    blockedByCategory: join.reason === "category",
    entryFee: row.entryFee,
    mixLabel: row.mix === "SINGLE" ? (single?.name ?? "Una categoría") : "Mixto",
    currentPhase: phase,
  };
}

async function inscribedTournamentPaid(
  tournamentIds: string[],
  participant: { id: string; documentId?: string | null } | null,
) {
  const map = new Map<string, boolean>();
  if (!participant || tournamentIds.length === 0) return map;
  const rows = await prisma.inscription.findMany({
    where: {
      tournamentId: { in: tournamentIds },
      OR: [
        { participantUserId: participant.id },
        ...(participant.documentId ? [{ player: { documentId: participant.documentId } }] : []),
      ],
    },
    select: { tournamentId: true, paid: true },
  });
  for (const row of rows) map.set(row.tournamentId, row.paid);
  return map;
}

export async function loadTournamentCatalog(
  months: HistoryMonths,
  participant: { id: string; documentId?: string | null } | null,
) {
  const cutoff = historyCutoff(months);
  const hiddenIds = await loadHiddenTournamentIds();
  const [activeRows, historyRows] = await Promise.all([
    prisma.tournament.findMany({
      where: { status: { in: ["REGISTRATION", "LIVE"] } },
      orderBy: [{ updatedAt: "desc" }],
      select: catalogSelect,
    }),
    prisma.tournament.findMany({
      where: {
        status: "CLOSED",
        OR: [{ date: { gte: cutoff } }, { AND: [{ date: null }, { updatedAt: { gte: cutoff } }] }],
      },
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
      select: catalogSelect,
    }),
  ]);

  const visibleActive = activeRows.filter((row) => !hiddenIds.has(row.id));
  const visibleHistory = historyRows.filter((row) => !hiddenIds.has(row.id));

  const liveFirst = [...visibleActive].sort((a, b) => {
    if (a.status !== b.status) return a.status === "LIVE" ? -1 : 1;
    const aTime = (a.date ?? a.updatedAt).getTime();
    const bTime = (b.date ?? b.updatedAt).getTime();
    return bTime - aTime;
  });

  const ids = [...liveFirst, ...visibleHistory].map((row) => row.id);
  const singleIds = [
    ...new Set(
      [...liveFirst, ...visibleHistory]
        .map((row) => row.singleCategoryId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const [inscribed, playerHint, singleRows] = await Promise.all([
    inscribedTournamentPaid(ids, participant),
    loadPlayerCategoryHint(participant),
    singleIds.length
      ? prisma.category.findMany({
          where: { id: { in: singleIds } },
          select: { id: true, name: true, distance: true },
        })
      : Promise.resolve([]),
  ]);
  const singles = new Map(singleRows.map((row) => [row.id, row]));
  const phases = await loadTournamentPhases([...liveFirst, ...visibleHistory]);

  return {
    months,
    active: liveFirst.map((row) => toCatalog(row, inscribed, playerHint, singles, phases.get(row.id) ?? null)),
    history: visibleHistory.map((row) => toCatalog(row, inscribed, playerHint, singles, phases.get(row.id) ?? null)),
  };
}
