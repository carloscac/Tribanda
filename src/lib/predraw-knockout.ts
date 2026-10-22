import {
  memberForPredrawSlot,
  parseKnockoutFirstRoundPairing,
  planPredrawKnockout,
  predrawSideMeta,
  validatePredrawBracket,
  type GroupStub,
} from "@/lib/bracket-predraw";
import { parseKnockoutFillMode } from "@/lib/knockout-entry";
import { prisma } from "@/lib/prisma";

export async function createPredrawnKnockoutForTournament(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament?.knockoutPreDraw) return { skipped: true as const };

  const groups = await prisma.group.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
    include: { members: true },
  });
  const withPlayers = groups.filter((g) => g.members.length >= 2);
  const fillMode = parseKnockoutFillMode(tournament.knockoutFillMode);
  const check = validatePredrawBracket(withPlayers.length, tournament.qualifyPerGroup, fillMode);
  if ("error" in check) return { error: check.error };

  const stubs: GroupStub[] = withPlayers.map((g) => ({
    id: g.id,
    name: g.name,
    sortOrder: g.sortOrder,
  }));
  const pairing = parseKnockoutFirstRoundPairing(tournament.knockoutFirstRoundPairing);
  const { plans } = planPredrawKnockout(
    stubs,
    tournament.qualifyPerGroup,
    pairing,
    tournament.knockoutDrawMode,
  );

  await prisma.$transaction(async (tx) => {
    await tx.match.deleteMany({ where: { tournamentId, phase: "KO" } });
    const idByKey = new Map<string, string>();

    for (const plan of plans) {
      const metaA = predrawSideMeta(plan.sideA);
      const metaB = predrawSideMeta(plan.sideB);
      const created = await tx.match.create({
        data: {
          tournamentId,
          phase: "KO",
          round: plan.round,
          bracketSlot: plan.slot,
          sideAId: null,
          sideBId: null,
          sideAGroupOrder: metaA.groupOrder,
          sideAPlace: metaA.place,
          sideBGroupOrder: metaB.groupOrder,
          sideBPlace: metaB.place,
          distanceA: 1,
          distanceB: 1,
          status: plan.isBye ? "CLOSED" : "SCHEDULED",
          winnerId: null,
          closeReason: plan.isBye ? "bye" : null,
        },
      });
      idByKey.set(`${plan.round}-${plan.slot}`, created.id);
    }

    for (const plan of plans) {
      if (plan.nextRound == null || plan.nextSlot == null) continue;
      const fromId = idByKey.get(`${plan.round}-${plan.slot}`);
      const toId = idByKey.get(`${plan.nextRound}-${plan.nextSlot}`);
      if (!fromId || !toId) continue;
      await tx.match.update({
        where: { id: fromId },
        data: {
          nextMatchId: toId,
          nextSide: plan.nextSide,
        },
      });
    }
  });

  await syncPredrawnKnockoutSides(tournamentId);
  return { ok: true as const };
}

export async function syncPredrawnKnockoutSides(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament?.knockoutPreDraw) return;

  const groups = await prisma.group.findMany({
    where: { tournamentId },
    include: { members: true },
  });
  const byOrder = new Map(groups.map((g) => [g.sortOrder, g]));

  const r1 = await prisma.match.findMany({
    where: { tournamentId, phase: "KO", round: 1 },
  });

  for (const m of r1) {
    const updates: {
      sideAId?: string | null;
      sideBId?: string | null;
      distanceA?: number;
      distanceB?: number;
    } = {};

    if (m.sideAGroupOrder != null && m.sideAPlace != null) {
      const g = byOrder.get(m.sideAGroupOrder);
      const id = g
        ? memberForPredrawSlot(g.members, m.sideAPlace)
        : null;
      if (id !== m.sideAId) {
        updates.sideAId = id;
        if (id) {
          const ins = await prisma.inscription.findUnique({ where: { id } });
          if (ins) updates.distanceA = ins.distance;
        }
      }
    }
    if (m.sideBGroupOrder != null && m.sideBPlace != null) {
      const g = byOrder.get(m.sideBGroupOrder);
      const id = g
        ? memberForPredrawSlot(g.members, m.sideBPlace)
        : null;
      if (id !== m.sideBId) {
        updates.sideBId = id;
        if (id) {
          const ins = await prisma.inscription.findUnique({ where: { id } });
          if (ins) updates.distanceB = ins.distance;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.match.update({ where: { id: m.id }, data: updates });
    }
  }

  for (const g of groups) {
    for (const member of g.members) {
      if (!member.qualified || member.seed == null) continue;
      await prisma.inscription.update({
        where: { id: member.inscriptionId },
        data: { koEligible: true },
      });
    }
  }
}
