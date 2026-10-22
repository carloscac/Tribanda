import { prisma } from "@/lib/prisma";
import { requireTournament, tournamentClosedMessage } from "@/lib/session";
import type { UserRole } from "@/lib/roles";

export async function loadGroupStructureContext(
  tournamentId: string,
  operatorId: string,
  role: UserRole,
) {
  const tournament = await requireTournament(tournamentId, operatorId, role);
  if (!tournament) return { error: "Torneo no encontrado." };
  const closed = tournamentClosedMessage(tournament);
  if (closed) return { error: closed };

  if (tournament.groupsFinalized) {
    return { error: "Los grupos ya están cerrados para edición de plazas." };
  }

  const finishedMatches = await prisma.match.count({
    where: {
      tournamentId,
      status: { in: ["CLOSED", "WALKOVER"] },
      NOT: { closeReason: "bye" },
    },
  });
  if (finishedMatches > 0) {
    return { error: "Ya hay partidos cerrados. No se puede cambiar la estructura." };
  }

  return { tournament };
}

export async function loadGroupMemberContext(
  tournamentId: string,
  operatorId: string,
  role: UserRole,
) {
  const tournament = await requireTournament(tournamentId, operatorId, role);
  if (!tournament) return { error: "Torneo no encontrado." };
  const closed = tournamentClosedMessage(tournament);
  if (closed) return { error: closed };
  return { tournament };
}
