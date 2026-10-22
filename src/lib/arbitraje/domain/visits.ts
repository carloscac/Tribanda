import { inningForNewVisit } from "./innings";
import type { Side, Visit } from "./types";

function cloneVisits(visits: Visit[]): Visit[] {
  return visits.map((visit) => ({ ...visit }));
}

/**
 * Suma una carambola. Misma rama que `addCaromOnSide` en `Torneos/web/src/lib/visits.ts`.
 * `createdVisitId` solo se usa cuando se abre una visita nueva.
 */
export function addCarom(
  visits: Visit[],
  side: Side,
  now: string,
  createdVisitId: string,
): Visit[] {
  const next = cloneVisits(visits);
  const open = [...next].reverse().find((visit) => !visit.endedAt);
  const last = next[next.length - 1];

  if (!open) {
    next.push({
      id: createdVisitId,
      side,
      inning: inningForNewVisit(last, side),
      caroms: 1,
      endedAt: null,
    });
    return next;
  }

  if (open.side !== side) {
    open.endedAt = now;
    next.push({
      id: createdVisitId,
      side,
      inning: inningForNewVisit(open, side),
      caroms: 1,
      endedAt: null,
    });
    return next;
  }

  open.caroms += 1;
  return next;
}

/** Abre la mesa para un jugador con cero carambolas. El primer toque es la salida. */
export function openBreak(visits: Visit[], side: Side, createdVisitId: string): Visit[] {
  const next = cloneVisits(visits);
  const open = [...next].reverse().find((visit) => !visit.endedAt);
  if (open) return next;
  const last = next[next.length - 1];
  next.push({
    id: createdVisitId,
    side,
    inning: inningForNewVisit(last, side),
    caroms: 0,
    endedAt: null,
  });
  return next;
}

/**
 * Cierra la visita y abre la del rival.
 * Misma rama que `passTurnOnMatch` en `Torneos/web/src/lib/visits.ts`.
 */
export function passTurn(
  visits: Visit[],
  side: Side | undefined,
  now: string,
  ids: { miss: string; next: string },
): Visit[] {
  const next = cloneVisits(visits);
  const open = [...next].reverse().find((visit) => !visit.endedAt);
  const last = next[next.length - 1];
  const finishing: Side =
    open?.side === "A" || open?.side === "B"
      ? open.side
      : side ?? (last?.side === "B" ? "A" : last?.side === "A" ? "B" : "A");

  let lastForInning: { side: Side; inning: number };
  if (open) {
    open.endedAt = now;
    lastForInning = { side: open.side, inning: open.inning };
  } else {
    const inning = inningForNewVisit(last, finishing);
    next.push({
      id: ids.miss,
      side: finishing,
      inning,
      caroms: 0,
      endedAt: now,
    });
    lastForInning = { side: finishing, inning };
  }

  const nextSide: Side = lastForInning.side === "A" ? "B" : "A";
  next.push({
    id: ids.next,
    side: nextSide,
    inning: inningForNewVisit(lastForInning, nextSide),
    caroms: 0,
    endedAt: null,
  });
  return next;
}

/**
 * Deshace la última carambola ya materializada en visitas (estado que llegó del servidor).
 * Misma rama que `undoLastCarom` en `Torneos/web/src/lib/visits.ts`.
 * Las acciones de esta tablet se deshacen cancelando el evento, no con esta resta.
 */
export function undoLastCarom(visits: Visit[]): { visits: Visit[] } | { error: string } {
  if (visits.length === 0) return { error: "No hay carambolas para deshacer." };
  const next = cloneVisits(visits);
  const open = [...next].reverse().find((visit) => !visit.endedAt);
  const target = open ?? next[next.length - 1];
  if (!target) return { error: "No hay carambolas para deshacer." };

  if (!open && target.endedAt) target.endedAt = null;

  if (target.caroms > 0) {
    target.caroms -= 1;
    return { visits: next };
  }

  const without = next.filter((visit) => visit.id !== target.id);
  const previous = without.at(-1);
  if (previous?.endedAt) previous.endedAt = null;
  return { visits: without };
}
