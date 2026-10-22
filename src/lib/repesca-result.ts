import { syncKoEligibleFromGroups } from "@/lib/knockout-entry";
import { prisma } from "@/lib/prisma";

/** Aplica ganador de repesca; si pierde un clasificado de grupo, pierde la plaza. */
export async function applyPlayInMatchResult(
  tournamentId: string,
  matchId: string,
  winnerId: string,
  sideAId: string | null,
  sideBId: string | null,
) {
  const loserId = winnerId === sideAId ? sideBId : sideAId;
  await prisma.$transaction(async (tx) => {
    await tx.inscription.update({
      where: { id: winnerId },
      data: { koEligible: true },
    });
    if (loserId) {
      await tx.inscription.update({
        where: { id: loserId },
        data: { koEligible: false, koManualPick: false },
      });
    }
  });
  await syncKoEligibleFromGroups(tournamentId);
}
