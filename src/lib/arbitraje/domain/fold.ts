import { playerAverage } from "./average";
import { cancelledEventIds } from "./cancel";
import type {
  HistoryItem,
  LocalMatch,
  MatchBaseline,
  MatchStatus,
  MatchView,
  RefereeEvent,
  ScoreSide,
  Side,
  StoredEvent,
  Visit,
} from "./types";
import { addCarom, openBreak, passTurn, undoLastCarom } from "./visits";
import { projectClock } from "./clock";

export { cancelledEventIds };

export function activeEvents(events: RefereeEvent[]) {
  const cancelled = cancelledEventIds(events);
  return events.filter((event) => event.type !== "UNDO" && !cancelled.has(event.id));
}

export function replayVisits(baseline: Visit[], events: RefereeEvent[]): Visit[] {
  const cancelled = cancelledEventIds(events);
  let visits = baseline.map((visit) => ({ ...visit }));
  for (const event of events) {
    if (cancelled.has(event.id) || event.type === "UNDO") continue;
    if (event.type === "CAROM" && event.side) {
      visits = addCarom(visits, event.side, event.createdAt, event.id);
    } else if (event.type === "BREAK" && event.side) {
      visits = openBreak(visits, event.side, event.id);
    } else if (event.type === "INNING") {
      visits = passTurn(visits, event.side, event.createdAt, {
        miss: `${event.id}:miss`,
        next: `${event.id}:next`,
      });
    } else if (event.type === "UNDO_SERVER") {
      const undone = undoLastCarom(visits);
      if ("visits" in undone) visits = undone.visits;
    }
  }
  return visits;
}

export function totalsFromVisits(visits: Visit[]) {
  const sideA = visits.filter((visit) => visit.side === "A");
  const sideB = visits.filter((visit) => visit.side === "B");
  const caromsA = sideA.reduce((sum, visit) => sum + visit.caroms, 0);
  const caromsB = sideB.reduce((sum, visit) => sum + visit.caroms, 0);
  const highRunA = sideA.reduce((max, visit) => Math.max(max, visit.caroms), 0);
  const highRunB = sideB.reduce((max, visit) => Math.max(max, visit.caroms), 0);
  const innings = visits.reduce((max, visit) => Math.max(max, visit.inning), 0);
  const open = [...visits].reverse().find((visit) => !visit.endedAt) ?? null;
  const closed = [...visits].reverse().find((visit) => visit.endedAt);
  return {
    caromsA,
    caromsB,
    highRunA,
    highRunB,
    innings,
    open,
    lastEntry: closed ? { side: closed.side, caroms: closed.caroms } : null,
  };
}

function scoreOf(
  caroms: number,
  highRun: number,
  serie: number,
  innings: number,
): ScoreSide {
  return {
    caroms,
    highRun,
    serie,
    average: playerAverage(caroms, innings),
  };
}

function eventLabel(event: RefereeEvent, baseline: MatchBaseline) {
  const name = event.side === "A" ? baseline.sideA.name : event.side === "B" ? baseline.sideB.name : "";
  switch (event.type) {
    case "CAROM":
      return `Carambola ${name}`.trim();
    case "BREAK":
      return `Salida ${name}`.trim();
    case "INNING":
      return "Entrada";
    case "UNDO":
      return "Deshacer";
    case "UNDO_SERVER":
      return "Deshacer carambola previa";
    case "PAUSE":
      return "Pausa";
    case "RESUME":
      return "Reanudar";
    case "TIMEOUT_START":
      return "Tiempo fuera";
    case "TIMEOUT_END":
      return "Fin del tiempo fuera";
    case "FINISH":
      return "Cierre del partido";
    default:
      return event.type;
  }
}

export function historyOf(events: StoredEvent[], baseline: MatchBaseline): HistoryItem[] {
  const cancelled = cancelledEventIds(events);
  return [...events].reverse().slice(0, 12).map((event) => ({
    id: event.id,
    label: eventLabel(event, baseline),
    at: event.createdAt,
    undone: cancelled.has(event.id),
    pending: event.sync !== "synced",
  }));
}

export type Projection = {
  status: MatchStatus;
  paused: boolean;
  closeReason: string | null;
  winnerSide: Side | null;
  visits: Visit[];
  caromsA: number;
  caromsB: number;
  highRunA: number;
  highRunB: number;
  innings: number;
  currentSide: Side | null;
  lastEntry: { side: Side; caroms: number } | null;
  serieA: number;
  serieB: number;
  inTimeout: boolean;
};

export function projectMatch(baseline: MatchBaseline, events: RefereeEvent[]): Projection {
  const cancelled = cancelledEventIds(events);
  let status: MatchStatus = baseline.status;
  let paused = baseline.paused;
  let closeReason = baseline.closeReason;
  let winnerSide = baseline.winnerSide;
  let inTimeout = false;

  for (const event of events) {
    if (cancelled.has(event.id) || event.type === "UNDO") continue;
    if (event.type === "CAROM" || event.type === "BREAK" || event.type === "INNING" || event.type === "UNDO_SERVER") {
      if (status === "SCHEDULED") status = "LIVE";
    } else if (event.type === "PAUSE") {
      paused = true;
      inTimeout = false;
    } else if (event.type === "RESUME") {
      paused = false;
      inTimeout = false;
      if (status === "SCHEDULED") status = "LIVE";
    } else if (event.type === "TIMEOUT_START") {
      paused = true;
      inTimeout = true;
      if (status === "SCHEDULED") status = "LIVE";
    } else if (event.type === "TIMEOUT_END") {
      paused = false;
      inTimeout = false;
    } else if (event.type === "FINISH") {
      status = "CLOSED";
      paused = false;
      inTimeout = false;
      closeReason = event.closeReason ?? closeReason;
      winnerSide = event.winnerSide ?? winnerSide;
    }
  }

  const visits = replayVisits(baseline.visits, events);
  const totals = totalsFromVisits(visits);
  const currentSide = totals.open?.side ?? null;
  return {
    status,
    paused: status === "CLOSED" || status === "WALKOVER" ? false : paused,
    closeReason,
    winnerSide,
    visits,
    caromsA: totals.caromsA,
    caromsB: totals.caromsB,
    highRunA: totals.highRunA,
    highRunB: totals.highRunB,
    innings: totals.innings,
    currentSide,
    lastEntry: totals.lastEntry,
    serieA: totals.open?.side === "A" ? totals.open.caroms : 0,
    serieB: totals.open?.side === "B" ? totals.open.caroms : 0,
    inTimeout: status === "CLOSED" || status === "WALKOVER" ? false : inTimeout,
  };
}

export function viewMatch(local: LocalMatch, nowMs: number): MatchView {
  const projected = projectMatch(local.baseline, local.events);
  const clock = projectClock(local.baseline, local.events, nowMs, projected);
  const winnerName =
    projected.winnerSide === "A"
      ? local.baseline.sideA.name
      : projected.winnerSide === "B"
        ? local.baseline.sideB.name
        : null;
  const baseA = local.baseline.sideA;
  const baseB = local.baseline.sideB;
  return {
    matchId: local.baseline.matchId,
    tournamentName: local.baseline.tournamentName,
    phaseLabel: local.baseline.phaseLabel,
    groupName: local.baseline.groupName,
    roundLabel: local.baseline.roundLabel,
    tableNumber: local.baseline.tableNumber,
    status: projected.status,
    paused: projected.paused,
    closeReason: projected.closeReason,
    winnerSide: projected.winnerSide,
    winnerName,
    currentSide: projected.currentSide,
    innings: projected.innings,
    maxInnings: local.baseline.maxInnings,
    lastEntry: projected.lastEntry,
    sideA: {
      ...baseA,
      caroms: projected.caromsA,
      serie: projected.serieA,
      highRun: projected.highRunA,
      average: playerAverage(projected.caromsA, projected.innings),
    },
    sideB: {
      ...baseB,
      caroms: projected.caromsB,
      serie: projected.serieB,
      highRun: projected.highRunB,
      average: playerAverage(projected.caromsB, projected.innings),
    },
    clock,
    history: historyOf(local.events, local.baseline),
    pendingCount: local.events.filter((event) => event.sync !== "synced").length,
    conflict: local.conflict,
    revision: local.ackedRevision,
  };
}

export function lastUndoable(events: RefereeEvent[]): RefereeEvent | null {
  const cancelled = cancelledEventIds(events);
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event || cancelled.has(event.id)) continue;
    return event;
  }
  return null;
}
