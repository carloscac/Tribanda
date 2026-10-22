import type { RefereeEvent } from "./types";

/** Un UNDO cancela su objetivo. Si ese UNDO luego se deshace, el objetivo vuelve a valer. */
export function cancelledEventIds(events: RefereeEvent[]) {
  const cancelled = new Set<string>();
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event || event.type !== "UNDO" || !event.targetEventId) continue;
    if (cancelled.has(event.id)) continue;
    cancelled.add(event.targetEventId);
  }
  return cancelled;
}
