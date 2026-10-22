import { roundTitle } from "@/lib/bracket";
import { STATUS_LABEL } from "@/lib/labels";
import {
  PARTICIPANT_SCREEN_KEYS,
  publicPathForScreen,
  type ParticipantScreenKey,
  type ParticipantScreens,
} from "@/lib/participant-screens";
import { prisma } from "@/lib/prisma";

export type TournamentPhaseKey = "REGISTRATION" | "GROUPS" | "AJUSTE" | "KO" | "CLOSED";

export type TournamentPhase = {
  key: TournamentPhaseKey;
  label: string;
  hrefKey: Extract<ParticipantScreenKey, "inicio" | "grupos" | "cuadro" | "mesas">;
};

type MatchSlice = {
  phase: string;
  round: number;
  status: string;
};

function isOpen(status: string) {
  return status === "LIVE" || status === "SCHEDULED";
}

export function resolveTournamentPhase(opts: {
  status: string;
  groupsFinalized: boolean;
  matches: MatchSlice[];
}): TournamentPhase {
  if (opts.status === "CLOSED") {
    return { key: "CLOSED", label: "Finalizado", hrefKey: "cuadro" };
  }
  if (opts.status === "DRAFT") {
    return { key: "REGISTRATION", label: "Borrador", hrefKey: "inicio" };
  }

  const live = opts.matches.filter((row) => row.status === "LIVE");
  const scheduled = opts.matches.filter((row) => row.status === "SCHEDULED");
  const active = live.length > 0 ? live : scheduled;

  const koOpen = active.filter((row) => row.phase === "KO");
  if (koOpen.length > 0) {
    const total = Math.max(1, ...opts.matches.filter((row) => row.phase === "KO").map((row) => row.round));
    const current = Math.min(...koOpen.map((row) => row.round));
    return { key: "KO", label: roundTitle(current, total), hrefKey: "cuadro" };
  }

  const ajusteOpen = active.filter((row) => row.phase === "PLAY_IN");
  if (ajusteOpen.length > 0) {
    return { key: "AJUSTE", label: "Ronda de ajuste", hrefKey: "mesas" };
  }

  const groupsOpen = active.filter((row) => row.phase === "GROUP");
  if (groupsOpen.length > 0) {
    return { key: "GROUPS", label: "Fase de grupos", hrefKey: "grupos" };
  }

  const hasGroup = opts.matches.some((row) => row.phase === "GROUP");
  const hasPlayIn = opts.matches.some((row) => row.phase === "PLAY_IN");
  const hasKo = opts.matches.some((row) => row.phase === "KO");

  if (hasGroup && !opts.groupsFinalized) {
    return { key: "GROUPS", label: "Fase de grupos", hrefKey: "grupos" };
  }
  if (hasPlayIn && opts.matches.some((row) => row.phase === "PLAY_IN" && isOpen(row.status))) {
    return { key: "AJUSTE", label: "Ronda de ajuste", hrefKey: "mesas" };
  }
  if (hasPlayIn && !hasKo) {
    return { key: "AJUSTE", label: "Ronda de ajuste", hrefKey: "mesas" };
  }
  if (hasKo) {
    const total = Math.max(1, ...opts.matches.filter((row) => row.phase === "KO").map((row) => row.round));
    return { key: "KO", label: roundTitle(total, total), hrefKey: "cuadro" };
  }
  if (opts.status === "LIVE" && hasGroup) {
    return { key: "GROUPS", label: "Fase de grupos", hrefKey: "grupos" };
  }
  if (opts.status === "REGISTRATION") {
    return { key: "REGISTRATION", label: "Inscripción", hrefKey: "inicio" };
  }
  if (opts.status === "LIVE") {
    return { key: "GROUPS", label: "En curso", hrefKey: "mesas" };
  }
  return {
    key: "REGISTRATION",
    label: STATUS_LABEL[opts.status] ?? opts.status,
    hrefKey: "inicio",
  };
}

export function phasePublicHref(
  slug: string,
  phase: TournamentPhase,
  visible?: ParticipantScreens | null,
) {
  const key = phase.hrefKey;
  if (!visible || visible[key] || key === "inicio") {
    return publicPathForScreen(slug, key);
  }
  const fallback = PARTICIPANT_SCREEN_KEYS.find((screen) => visible[screen]) ?? "inicio";
  return publicPathForScreen(slug, fallback);
}

export async function loadTournamentPhase(
  tournamentId: string,
  status: string,
  groupsFinalized: boolean,
): Promise<TournamentPhase> {
  const matches = await prisma.match.findMany({
    where: { tournamentId },
    select: { phase: true, round: true, status: true },
  });
  return resolveTournamentPhase({ status, groupsFinalized, matches });
}

export async function loadTournamentPhases(
  rows: { id: string; status: string; groupsFinalized: boolean }[],
): Promise<Map<string, TournamentPhase>> {
  const map = new Map<string, TournamentPhase>();
  if (rows.length === 0) return map;

  const matches = await prisma.match.findMany({
    where: { tournamentId: { in: rows.map((row) => row.id) } },
    select: { tournamentId: true, phase: true, round: true, status: true },
  });
  const byTournament = new Map<string, MatchSlice[]>();
  for (const row of matches) {
    const list = byTournament.get(row.tournamentId) ?? [];
    list.push(row);
    byTournament.set(row.tournamentId, list);
  }
  for (const row of rows) {
    map.set(
      row.id,
      resolveTournamentPhase({
        status: row.status,
        groupsFinalized: row.groupsFinalized,
        matches: byTournament.get(row.id) ?? [],
      }),
    );
  }
  return map;
}
