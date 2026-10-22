"use server";

import { prisma } from "@/lib/prisma";
import { revalidateTournament } from "@/lib/revalidate";
import { requireOrganizerOrAdmin } from "@/lib/session-user";
import { canEnterRepesca, parseKnockoutFillMode } from "@/lib/knockout-entry";
import { isTournamentOwnerOrAdmin } from "@/lib/tournament-access";
import { tournamentClosedMessage } from "@/lib/session";

export async function setRepescaOptIn(
  _prevState: { error?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const operator = await requireOrganizerOrAdmin();
  const inscriptionId = String(formData.get("inscriptionId") ?? "");
  const optInRaw = String(formData.get("optIn") ?? "");
  const feePaid = formData.get("feePaid") === "on";

  const row = await prisma.inscription.findFirst({
    where: { id: inscriptionId },
    include: { tournament: true, groupMembers: true },
  });
  if (!row || !isTournamentOwnerOrAdmin(row.tournament.userId, operator)) {
    return { error: "Inscripción no encontrada." };
  }
  const closed = tournamentClosedMessage(row.tournament);
  if (closed) return { error: closed };

  const fillMode = parseKnockoutFillMode(row.tournament.knockoutFillMode);
  if (!canEnterRepesca(row.groupMembers, row.tournament.groupsFinalized, fillMode)) {
    return {
      error:
        "Repesca: quien no clasificó en su grupo, o inscritos sin grupo (modo repesca, grupos cerrados).",
    };
  }

  const groupQualified = row.groupMembers.some((gm) => gm.qualified);
  if (groupQualified && optInRaw === "yes") {
    return {
      error:
        "Este jugador ya clasificó en su grupo y tiene plaza en el cuadro. La repesca por cupos vacíos es para eliminados de grupo o inscripciones extra.",
    };
  }
  if (row.koEligible && optInRaw === "yes") {
    const wonPlayIn = await prisma.match.findFirst({
      where: {
        tournamentId: row.tournamentId,
        phase: "PLAY_IN",
        status: { in: ["CLOSED", "WALKOVER"] },
        winnerId: row.id,
      },
    });
    if (wonPlayIn) {
      return { error: "Ya ganó un partido de ajuste y tiene plaza." };
    }
  }

  let repescaOptIn: boolean | null = null;
  if (optInRaw === "yes") repescaOptIn = true;
  else if (optInRaw === "no") repescaOptIn = false;

  const feeRequired =
    row.tournament.repescaFee != null && row.tournament.repescaFee > 0 && repescaOptIn === true;

  await prisma.inscription.update({
    where: { id: inscriptionId },
    data: {
      repescaOptIn,
      repescaFeePaid: repescaOptIn === true ? feePaid || !feeRequired : false,
      ...(repescaOptIn === true && !groupQualified
        ? { koEligible: false, koManualPick: false }
        : {}),
    },
  });

  revalidateTournament(row.tournamentId);
  return { ok: true };
}
