import { decideWinner, isFinished } from "./finish";
import { lastUndoable, projectMatch, viewMatch } from "./fold";
import { permissionError } from "./permissions";
import type { LocalMatch, MatchBaseline, MatchView, RefereeEvent, RefereeUser, Side, StoredEvent } from "./types";

export type CommandContext = {
  user: RefereeUser;
  deviceId: string;
  now: string;
  ids: () => string;
};

export type Command =
  | { type: "CAROM"; matchId: string; side: Side }
  | { type: "BREAK"; matchId: string; side: Side }
  | { type: "INNING"; matchId: string; side?: Side }
  | { type: "UNDO"; matchId: string }
  | { type: "PAUSE"; matchId: string }
  | { type: "RESUME"; matchId: string }
  | { type: "TIMEOUT_START"; matchId: string }
  | { type: "TIMEOUT_END"; matchId: string }
  | { type: "FINISH"; matchId: string; winnerSide?: Side };

export type CommandOutcome =
  | { ok: true; match: LocalMatch; event: StoredEvent; view: MatchView }
  | { ok: false; error: string; match: LocalMatch; view: MatchView };

function outcomeError(match: LocalMatch, now: string, error: string): CommandOutcome {
  return { ok: false, error, match, view: viewMatch(match, Date.parse(now)) };
}

function append(match: LocalMatch, event: RefereeEvent): LocalMatch {
  const stored: StoredEvent = { ...event, sync: "pending", attempts: 0 };
  return { ...match, events: [...match.events, stored], conflict: match.conflict };
}

export function dispatch(match: LocalMatch, command: Command, ctx: CommandContext): CommandOutcome {
  const nowMs = Date.parse(ctx.now);
  if (command.matchId !== match.baseline.matchId) {
    return outcomeError(match, ctx.now, "La acción pertenece a otro partido.");
  }
  const denied = permissionError(ctx.user, match.baseline);
  if (denied) return outcomeError(match, ctx.now, denied);
  const view = viewMatch(match, nowMs);
  const scoring = command.type === "CAROM" || command.type === "BREAK" || command.type === "INNING";
  if (isFinished(view.status) && command.type !== "UNDO") {
    return outcomeError(match, ctx.now, "El partido ya está cerrado.");
  }
  if (scoring && (view.paused || view.clock.inTimeout)) {
    return outcomeError(match, ctx.now, "El partido está en pausa.");
  }
  if (!match.baseline.sideA.inscriptionId || !match.baseline.sideB.inscriptionId) {
    return outcomeError(match, ctx.now, "Faltan jugadores.");
  }

  const base = {
    id: ctx.ids(),
    matchId: match.baseline.matchId,
    refereeId: ctx.user.id,
    deviceId: ctx.deviceId,
    createdAt: ctx.now,
  };

  if (command.type === "CAROM") {
    const next = append(match, { ...base, type: "CAROM", side: command.side });
    return { ok: true, match: next, event: next.events.at(-1)!, view: viewMatch(next, nowMs) };
  }

  if (command.type === "BREAK") {
    const next = append(match, { ...base, type: "BREAK", side: command.side });
    return { ok: true, match: next, event: next.events.at(-1)!, view: viewMatch(next, nowMs) };
  }

  if (command.type === "INNING") {
    const next = append(match, { ...base, type: "INNING", side: command.side ?? view.currentSide ?? "A" });
    return { ok: true, match: next, event: next.events.at(-1)!, view: viewMatch(next, nowMs) };
  }

  if (command.type === "UNDO") {
    const target = lastUndoable(match.events);
    if (isFinished(view.status) && target?.type !== "FINISH") {
      return outcomeError(match, ctx.now, "El partido ya está cerrado.");
    }
    if (!target && match.baseline.visits.length === 0) {
      return outcomeError(match, ctx.now, "No hay acciones para deshacer.");
    }
    const event: RefereeEvent = target
      ? { ...base, type: "UNDO", targetEventId: target.id }
      : { ...base, type: "UNDO_SERVER" };
    const next = append(match, event);
    return { ok: true, match: next, event: next.events.at(-1)!, view: viewMatch(next, nowMs) };
  }

  if (command.type === "PAUSE") {
    if (view.paused || view.clock.inTimeout) return outcomeError(match, ctx.now, "El partido ya está en pausa.");
    const next = append(match, { ...base, type: "PAUSE" });
    return { ok: true, match: next, event: next.events.at(-1)!, view: viewMatch(next, nowMs) };
  }

  if (command.type === "RESUME") {
    if (view.clock.inTimeout) {
      return outcomeError(match, ctx.now, "Cierra el tiempo fuera para continuar.");
    }
    if (!view.paused) return outcomeError(match, ctx.now, "El partido no está en pausa.");
    const next = append(match, { ...base, type: "RESUME" });
    return { ok: true, match: next, event: next.events.at(-1)!, view: viewMatch(next, nowMs) };
  }

  if (command.type === "TIMEOUT_START") {
    if (view.clock.inTimeout) return outcomeError(match, ctx.now, "Ya hay un tiempo fuera en curso.");
    const next = append(match, { ...base, type: "TIMEOUT_START" });
    return { ok: true, match: next, event: next.events.at(-1)!, view: viewMatch(next, nowMs) };
  }

  if (command.type === "TIMEOUT_END") {
    if (!view.clock.inTimeout) return outcomeError(match, ctx.now, "No hay un tiempo fuera en curso.");
    const next = append(match, { ...base, type: "TIMEOUT_END" });
    return { ok: true, match: next, event: next.events.at(-1)!, view: viewMatch(next, nowMs) };
  }

  const projected = projectMatch(match.baseline, match.events);
  const decision = decideWinner({
    caromsA: projected.caromsA,
    caromsB: projected.caromsB,
    innings: projected.innings,
    distanceA: match.baseline.sideA.distance,
    distanceB: match.baseline.sideB.distance,
    equalInnings: match.baseline.equalInnings,
    maxInnings: match.baseline.maxInnings,
  });

  let winnerSide: Side;
  let closeReason: string;
  if (!("error" in decision)) {
    winnerSide = decision.winner;
    closeReason = decision.reason;
    if (command.winnerSide && command.winnerSide !== winnerSide) {
      winnerSide = command.winnerSide;
      closeReason = "resultado";
    }
  } else if (command.winnerSide) {
    winnerSide = command.winnerSide;
    closeReason = "resultado";
  } else {
    return outcomeError(match, ctx.now, decision.error);
  }

  const next = append(match, { ...base, type: "FINISH", winnerSide, closeReason });
  return { ok: true, match: next, event: next.events.at(-1)!, view: viewMatch(next, nowMs) };
}

export function openLocalMatch(baseline: MatchBaseline): LocalMatch {
  return {
    baseline,
    events: [],
    ackedRevision: baseline.revision,
    conflict: null,
  };
}
