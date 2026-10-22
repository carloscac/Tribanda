import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/session-user";
import { canAccessOrganizerApp, findTournamentForAccess } from "@/lib/tournament-access";

/** Comprueba acceso al torneo y devuelve el dueño (jugadores/categorías del organizador). */
export async function getOrganizerTournamentContext(id: string) {
  const user = await getSessionUser();
  if (!user || !canAccessOrganizerApp(user.role)) notFound();

  const tournament = await findTournamentForAccess(id, user.id, user.role);
  if (!tournament) notFound();

  return { user, tournament, ownerId: tournament.userId };
}
