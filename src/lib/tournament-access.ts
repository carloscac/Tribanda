import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/lib/roles";

/** Torneos visibles para el jugador en /participante (no borrador ni cerrado). */
export const PARTICIPANT_ACTIVE_TOURNAMENT_STATUSES = ["REGISTRATION", "LIVE"] as const;

export function canAccessOrganizerApp(role: UserRole) {
  return role === "ADMIN" || role === "ORGANIZER";
}

export function isTournamentOwnerOrAdmin(
  tournamentUserId: string,
  operator: { id: string; role: UserRole },
) {
  return operator.role === "ADMIN" || tournamentUserId === operator.id;
}

export function tournamentListWhere(userId: string, role: UserRole) {
  if (role === "ADMIN") return {};
  return { userId };
}

export function tournamentDetailWhere(id: string, userId: string, role: UserRole) {
  if (role === "ADMIN") return { id };
  return { id, userId };
}

export async function findTournamentForAccess(id: string, userId: string, role: UserRole) {
  return prisma.tournament.findFirst({
    where: tournamentDetailWhere(id, userId, role),
    omit: { imageData: true },
  });
}

export function ownedMatchWhere(matchId: string, userId: string, role: UserRole) {
  if (role === "ADMIN") return { id: matchId };
  return { id: matchId, tournament: { userId } };
}

export function ownedGroupWhere(groupId: string, userId: string, role: UserRole) {
  if (role === "ADMIN") return { id: groupId };
  return { id: groupId, tournament: { userId } };
}
