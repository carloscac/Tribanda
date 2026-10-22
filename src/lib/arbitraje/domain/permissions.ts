import type { MatchBaseline, RefereeUser } from "./types";

/**
 * Tribanda no tiene un árbitro asignado por partido.
 * Quien puede anotar es el organizador dueño del torneo, o un administrador.
 * Misma regla que `ownedMatchWhere` en `Torneos/web/src/lib/tournament-access.ts`.
 */
export function canArbitrate(user: RefereeUser, match: Pick<MatchBaseline, "organizerId">) {
  if (!user.active) return false;
  if (user.role === "ADMIN") return true;
  if (user.role !== "ORGANIZER") return false;
  return user.id === match.organizerId;
}

export function permissionError(user: RefereeUser, match: Pick<MatchBaseline, "organizerId">) {
  if (canArbitrate(user, match)) return null;
  if (!user.active) return "La cuenta está inactiva.";
  if (user.role === "PARTICIPANT") return "Un participante no puede arbitrar.";
  return "Este árbitro no está autorizado para el partido.";
}
