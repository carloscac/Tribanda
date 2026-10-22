import type { MatchStatus, Visit } from "./types";

export type RevisionInput = {
  status: MatchStatus | string;
  paused: boolean;
  caromsA: number;
  caromsB: number;
  innings: number;
  highRunA: number;
  highRunB: number;
  closeReason: string | null;
  winnerSide: string | null;
  visits: Visit[];
};

/**
 * Revisión canónica. Cliente y servidor deben producir el mismo texto
 * para detectar cambios concurrentes. No incluye datos personales.
 */
export function revisionPayload(input: RevisionInput) {
  return JSON.stringify({
    status: input.status,
    paused: input.paused,
    caromsA: input.caromsA,
    caromsB: input.caromsB,
    innings: input.innings,
    highRunA: input.highRunA,
    highRunB: input.highRunB,
    closeReason: input.closeReason,
    winnerSide: input.winnerSide,
    visits: input.visits.map((visit) => [
      visit.id,
      visit.side,
      visit.inning,
      visit.caroms,
      visit.endedAt,
    ]),
  });
}

export async function revisionOf(input: RevisionInput) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(revisionPayload(input)),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 20);
}
