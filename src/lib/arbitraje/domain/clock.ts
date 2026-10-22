import { cancelledEventIds } from "./cancel";
import type { ClockView, MatchBaseline, MatchStatus, RefereeEvent, Side } from "./types";

type ClockProjection = {
  status: MatchStatus;
  paused: boolean;
  inTimeout: boolean;
};

type OpenInterval = { start: number; end: number | null; kind: "run" | "timeout" };

/**
 * El reloj sale de marcas de tiempo, no de un contador en memoria.
 * Si el servidor solo entrega `liveStartedAt` y el partido ya estaba en pausa,
 * el inicio de esa pausa se ancla a `pulledAt` y se marca como aproximado:
 * Tribanda no guarda cuándo empezó la pausa.
 */
export function projectClock(
  baseline: MatchBaseline,
  events: RefereeEvent[],
  nowMs: number,
  projected: ClockProjection,
): ClockView {
  const cancelled = cancelledEventIds(events);
  const intervals: OpenInterval[] = [];
  let mode: "idle" | "run" | "paused" | "timeout" = "idle";
  let pauseAnchorApproximate = false;
  let timeoutCount = 0;

  const closeOpen = (at: number) => {
    const open = intervals.findLast((interval) => interval.end == null);
    if (open && open.end == null) open.end = at;
  };

  if (baseline.liveStartedAt && baseline.status !== "SCHEDULED") {
    const start = Date.parse(baseline.liveStartedAt);
    if (baseline.paused) {
      const end = Date.parse(baseline.pulledAt);
      intervals.push({ start, end: Number.isFinite(end) ? end : start, kind: "run" });
      mode = "paused";
      pauseAnchorApproximate = true;
    } else if (Number.isFinite(start)) {
      intervals.push({ start, end: null, kind: "run" });
      mode = "run";
    }
  }

  for (const event of events) {
    if (cancelled.has(event.id) || event.type === "UNDO") continue;
    const at = Date.parse(event.createdAt);
    if (!Number.isFinite(at)) continue;

    if ((event.type === "CAROM" || event.type === "BREAK" || event.type === "INNING") && mode === "idle") {
      intervals.push({ start: at, end: null, kind: "run" });
      mode = "run";
      pauseAnchorApproximate = false;
    } else if (event.type === "PAUSE" || event.type === "FINISH") {
      closeOpen(at);
      mode = "paused";
    } else if (event.type === "TIMEOUT_START") {
      closeOpen(at);
      intervals.push({ start: at, end: null, kind: "timeout" });
      mode = "timeout";
      timeoutCount += 1;
    } else if (event.type === "RESUME" || event.type === "TIMEOUT_END") {
      closeOpen(at);
      intervals.push({ start: at, end: null, kind: "run" });
      mode = "run";
      pauseAnchorApproximate = false;
    }
  }

  if (projected.status === "CLOSED" || projected.status === "WALKOVER") {
    closeOpen(nowMs);
    mode = "paused";
  }

  let elapsedMs = 0;
  for (const interval of intervals) {
    if (interval.kind !== "run") continue;
    const end = interval.end ?? nowMs;
    elapsedMs += Math.max(0, end - interval.start);
  }

  const atTable = initialSide(baseline);
  const players = playerElapsed(baseline, events, nowMs, projected, atTable);
  const shot = shotClock(baseline, events, nowMs, projected, atTable);
  const limit = baseline.timeConfig.matchLimitMs;
  return {
    elapsedMs,
    elapsedMsA: players.a,
    elapsedMsB: players.b,
    shotLimitMs: SHOT_LIMIT_MS,
    shotRemainingMsA: shot.a,
    shotRemainingMsB: shot.b,
    remainingMs: limit == null ? null : limit - elapsedMs,
    running: mode === "run" && !projected.paused && !projected.inTimeout,
    paused: projected.paused && !projected.inTimeout,
    inTimeout: projected.inTimeout,
    pauseAnchorApproximate,
    timeoutCount,
    matchLimitMs: limit,
    timeoutLimitMs: baseline.timeConfig.timeoutLimitMs,
  };
}

function initialSide(baseline: MatchBaseline): Side | null {
  const open = [...baseline.visits].reverse().find((visit) => !visit.endedAt);
  return open?.side ?? null;
}

/**
 * Cada jugador acumula el tiempo en que tiene la mesa.
 * La pausa y el tiempo fuera no corren. No hay tope reglamentario:
 * Tribanda no guarda un límite por jugador.
 */
function playerElapsed(
  baseline: MatchBaseline,
  events: RefereeEvent[],
  nowMs: number,
  projected: ClockProjection,
  atTable: Side | null,
) {
  const cancelled = cancelledEventIds(events);
  const intervals: Array<{ side: Side; start: number; end: number | null }> = [];
  let running = false;

  const stop = (at: number) => {
    const open = intervals.findLast((interval) => interval.end == null);
    if (open && open.end == null) open.end = at;
    running = false;
  };
  const start = (side: Side, at: number) => {
    stop(at);
    intervals.push({ side, start: at, end: null });
    atTable = side;
    running = true;
  };

  if (atTable && baseline.liveStartedAt && baseline.status !== "SCHEDULED" && !baseline.paused) {
    const opened = Date.parse(baseline.pulledAt);
    if (Number.isFinite(opened)) start(atTable, opened);
  }

  for (const event of events) {
    if (cancelled.has(event.id) || event.type === "UNDO") continue;
    const at = Date.parse(event.createdAt);
    if (!Number.isFinite(at)) continue;
    if (event.type === "BREAK" && event.side) {
      if (!running) start(event.side, at);
    } else if (event.type === "CAROM" && event.side) {
      if (!running || atTable !== event.side) start(event.side, at);
    } else if (event.type === "INNING") {
      const finishing = atTable ?? event.side ?? "A";
      const next: Side = finishing === "A" ? "B" : "A";
      start(next, at);
    } else if (event.type === "PAUSE" || event.type === "TIMEOUT_START" || event.type === "FINISH") {
      stop(at);
    } else if ((event.type === "RESUME" || event.type === "TIMEOUT_END") && atTable) {
      start(atTable, at);
    }
  }

  if (projected.status === "CLOSED" || projected.status === "WALKOVER" || projected.paused || projected.inTimeout) {
    stop(nowMs);
  }

  let a = 0;
  let b = 0;
  for (const interval of intervals) {
    const end = interval.end ?? nowMs;
    const span = Math.max(0, end - interval.start);
    if (interval.side === "A") a += span;
    else b += span;
  }
  return { a, b };
}

/** Cada tiro tiene 40 segundos. Tribanda no trae este tope; es la regla de la mesa. */
export const SHOT_LIMIT_MS = 40_000;

/**
 * El jugador que tiene el turno cuenta 40 segundos para el tiro.
 * Cada carambola reinicia los 40. Una entrada se los da al otro.
 * La pausa y el tiempo fuera congelan la cuenta. Al llegar a cero se queda en cero.
 */
function shotClock(
  baseline: MatchBaseline,
  events: RefereeEvent[],
  nowMs: number,
  projected: ClockProjection,
  atTable: Side | null,
) {
  const cancelled = cancelledEventIds(events);
  let active: Side | null = null;
  let spent = 0;
  let tickingFrom: number | null = null;

  const freeze = (at: number) => {
    if (tickingFrom != null) {
      spent += Math.max(0, at - tickingFrom);
      tickingFrom = null;
    }
  };
  const beginShot = (side: Side, at: number) => {
    freeze(at);
    active = side;
    spent = 0;
    tickingFrom = at;
  };

  if (atTable && baseline.liveStartedAt && baseline.status === "LIVE" && !baseline.paused) {
    const opened = Date.parse(baseline.pulledAt);
    if (Number.isFinite(opened)) beginShot(atTable, opened);
  }

  for (const event of events) {
    if (cancelled.has(event.id) || event.type === "UNDO") continue;
    const at = Date.parse(event.createdAt);
    if (!Number.isFinite(at)) continue;
    if (event.type === "BREAK" && event.side) {
      beginShot(event.side, at);
    } else if (event.type === "CAROM" && event.side) {
      beginShot(event.side, at);
    } else if (event.type === "INNING") {
      const finishing = active ?? event.side ?? "A";
      beginShot(finishing === "A" ? "B" : "A", at);
    } else if (event.type === "PAUSE" || event.type === "TIMEOUT_START" || event.type === "FINISH") {
      freeze(at);
    } else if ((event.type === "RESUME" || event.type === "TIMEOUT_END") && active) {
      tickingFrom = at;
    }
  }

  if (projected.status === "CLOSED" || projected.status === "WALKOVER" || projected.paused || projected.inTimeout) {
    freeze(nowMs);
  }

  const remaining = (side: Side) => {
    if (active !== side) return SHOT_LIMIT_MS;
    const extra = tickingFrom == null ? 0 : Math.max(0, nowMs - tickingFrom);
    return Math.max(0, SHOT_LIMIT_MS - spent - extra);
  };
  return { a: remaining("A"), b: remaining("B") };
}

export function formatShot(ms: number) {
  return String(Math.max(0, Math.ceil(ms / 1000)));
}

export function formatClock(ms: number) {
  const sign = ms < 0 ? "-" : "";
  const total = Math.abs(Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const hh = hours > 0 ? `${hours}:` : "";
  return `${sign}${hh}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
