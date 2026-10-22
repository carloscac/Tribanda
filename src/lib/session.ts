import { findTournamentForAccess } from "@/lib/tournament-access";
import { requireOrganizerOrAdmin } from "@/lib/session-user";
import type { UserRole } from "@/lib/roles";

export async function requireUserId() {
  const user = await requireOrganizerOrAdmin();
  return user.id;
}

export async function requireUserRole(): Promise<{ userId: string; role: UserRole }> {
  const user = await requireOrganizerOrAdmin();
  return { userId: user.id, role: user.role };
}

export async function requireTournament(id: string, userId: string, role: UserRole) {
  const tournament = await findTournamentForAccess(id, userId, role);
  if (!tournament) return null;
  return tournament;
}

export async function requireTournamentForAction(tournamentId: string) {
  const user = await requireOrganizerOrAdmin();
  const tournament = await findTournamentForAccess(tournamentId, user.id, user.role);
  if (!tournament) return null;
  return { user, tournament, ownerId: tournament.userId };
}

export function tournamentClosedMessage(tournament: { status: string }) {
  if (tournament.status === "CLOSED") return "El torneo ya está finalizado.";
  return null;
}
