import { memberGroupStats } from "@/lib/bracket";
import { qualificationFromStanding } from "@/lib/group-standing";
import { readGroupTiebreak } from "@/lib/group-tiebreak-db";
import { parseKnockoutFillMode, syncKoEligibleFromGroups } from "@/lib/knockout-entry";
import { realKoWhere } from "@/lib/ko";
import { prisma } from "@/lib/prisma";

function finished(status: string) {
  return status === "CLOSED" || status === "WALKOVER";
}

export async function syncGroupQualification(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    omit: { imageData: true },
  });
  if (!tournament) return;

  const groups = await prisma.group.findMany({
    where: { tournamentId },
    include: { members: true, matches: true },
  });

  for (const group of groups) {
    const allDone = group.matches.length > 0 && group.matches.every((m) => finished(m.status));

    if (!allDone) {
      await prisma.group.update({
        where: { id: group.id },
        data: { status: "OPEN", tiebreakNote: null },
      });
      await prisma.groupMember.updateMany({
        where: { groupId: group.id },
        data: { qualified: false, seed: null },
      });
      continue;
    }

    if (group.status === "RESOLVED") continue;

    const mode = await readGroupTiebreak(tournamentId);
    const rows = group.members.map((member) => ({
      inscriptionId: member.inscriptionId,
      groupSort: group.sortOrder,
      ...memberGroupStats(member.inscriptionId, group.matches),
    }));
    const { auto, tie } = qualificationFromStanding(rows, tournament.qualifyPerGroup, mode);

    await prisma.group.update({
      where: { id: group.id },
      data: { status: tie.length === 0 ? "RESOLVED" : "TIE", tiebreakNote: null },
    });

    for (const member of group.members) {
      const seed = auto.findIndex((a) => a.inscriptionId === member.inscriptionId);
      await prisma.groupMember.update({
        where: { id: member.id },
        data: { qualified: seed >= 0, seed: seed >= 0 ? seed + 1 : null },
      });
    }
  }

  await syncKoEligibleFromGroups(tournamentId);
  await syncRepescaSlotFlags(tournamentId);

  const { syncPredrawnKnockoutSides } = await import("@/lib/predraw-knockout");
  await syncPredrawnKnockoutSides(tournamentId);
}

/** Elimina plazas erróneas en eliminados con repesca (sin victoria en ajuste ni pase manual). */
export async function syncRepescaSlotFlags(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament || parseKnockoutFillMode(tournament.knockoutFillMode) !== "PLAY_IN") return;

  const rows = await prisma.inscription.findMany({
    where: { tournamentId, repescaOptIn: true },
    select: {
      id: true,
      koEligible: true,
      koManualPick: true,
      groupMembers: { select: { qualified: true } },
    },
  });

  for (const ins of rows) {
    if (ins.groupMembers.some((gm) => gm.qualified)) continue;
    if (ins.koManualPick) continue;
    const wonPlayIn = await prisma.match.findFirst({
      where: {
        tournamentId,
        phase: "PLAY_IN",
        status: { in: ["CLOSED", "WALKOVER"] },
        winnerId: ins.id,
      },
      select: { id: true },
    });
    if (wonPlayIn) continue;
    if (ins.koEligible) {
      await prisma.inscription.update({
        where: { id: ins.id },
        data: { koEligible: false },
      });
    }
  }
}

export async function dropKnockoutIfIdle(tournamentId: string) {
  const realKo = await prisma.match.count({ where: realKoWhere(tournamentId) });
  if (realKo > 0) return false;
  await prisma.match.deleteMany({ where: { tournamentId, phase: "KO" } });
  return true;
}
