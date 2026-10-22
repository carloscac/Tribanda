"use server";

import {
  countGroupQualified,
  countKoEligible,
  isConfirmedRepescaParticipant,
  parseKnockoutFillMode,
  syncKoEligibleFromGroups,
} from "@/lib/knockout-entry";
import { realKoWhere } from "@/lib/ko";
import { collectAjustePools, collectPlayedPairs, planRondaAjuste } from "@/lib/ajuste";
import { readGroupTiebreak } from "@/lib/group-tiebreak-db";
import { playInAssignedInscriptionIds } from "@/lib/play-in-setup";
import { prisma } from "@/lib/prisma";
import { syncGroupQualification } from "@/lib/qualification";
import { revalidateTournament } from "@/lib/revalidate";
import type { UserRole } from "@/lib/roles";
import { requireOrganizerOrAdmin } from "@/lib/session-user";
import { requireTournament, tournamentClosedMessage } from "@/lib/session";

export async function generatePlayInMatches(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const tournamentId = String(formData.get("tournamentId") ?? "");
  const bracketSize = Number(formData.get("bracketSize") ?? 16);

  const tournament = await requireTournament(tournamentId, operator.id, operator.role);
  if (!tournament) return { error: "Torneo no encontrado." };
  const closed = tournamentClosedMessage(tournament);
  if (closed) return { error: closed };
  if (parseKnockoutFillMode(tournament.knockoutFillMode) !== "PLAY_IN") {
    return { error: "Este torneo no está en modo ronda de ajuste." };
  }
  if (!tournament.groupsFinalized) {
    return { error: "Cierra la fase de grupos antes de generar la ronda de ajuste." };
  }
  if (!Number.isInteger(bracketSize) || (bracketSize & (bracketSize - 1)) !== 0) {
    return { error: "Tamaño de cuadro no válido." };
  }

  await syncGroupQualification(tournamentId);

  const unresolved = await prisma.group.count({
    where: { tournamentId, status: { not: "RESOLVED" } },
  });
  if (unresolved > 0) {
    return { error: "Todos los grupos deben estar resueltos antes de la ronda de ajuste." };
  }

  const realKo = await prisma.match.count({ where: realKoWhere(tournamentId) });
  if (realKo > 0) return { error: "Ya hay eliminatoria jugada." };

  const playInOpen = await prisma.match.count({
    where: { tournamentId, phase: "PLAY_IN", status: { in: ["SCHEDULED", "LIVE"] } },
  });
  if (playInOpen > 0) {
    return { error: "Hay partidos de ajuste sin cerrar. Registra resultados o bórralos antes de generar otra ronda." };
  }
  const playInDone = await prisma.match.count({
    where: { tournamentId, phase: "PLAY_IN", status: { in: ["CLOSED", "WALKOVER"] } },
  });
  if (playInDone > 0) {
    return { error: "Ya hay partidos de ajuste cerrados. No se puede regenerar la ronda." };
  }

  const planned = await buildAjustePlanForTournament(tournamentId, bracketSize, tournament);
  if ("error" in planned) return { error: planned.error };

  const passIds = new Set([
    ...planned.firstIds,
    ...planned.plan.passDirect.map((row) => row.inscriptionId),
  ]);

  const allInscriptions = await prisma.inscription.findMany({
    where: { tournamentId },
    select: { id: true },
  });
  await prisma.$transaction(async (tx) => {
    for (const row of allInscriptions) {
      await tx.inscription.update({
        where: { id: row.id },
        data: {
          koEligible: passIds.has(row.id),
          koManualPick: planned.plan.passDirect.some((p) => p.inscriptionId === row.id),
        },
      });
    }
    await tx.match.deleteMany({ where: { tournamentId, phase: "PLAY_IN" } });
    for (let i = 0; i < planned.plan.matches.length; i += 1) {
      const match = planned.plan.matches[i];
      const a = match.sideA;
      const b = match.sideB;
      const playInKind =
        a.tag === "reencauche" && b.tag === "reencauche" ? "ELIM_VS_ELIM" : "ELIM_VS_QUALIFIED";
      await tx.match.create({
        data: {
          tournamentId,
          phase: "PLAY_IN",
          round: 0,
          bracketSlot: i,
          sideAId: a.inscriptionId,
          sideBId: b.inscriptionId,
          distanceA: a.distance,
          distanceB: b.distance,
          status: "SCHEDULED",
          playInKind,
        },
      });
    }
  });

  await syncKoEligibleFromGroups(tournamentId);
  revalidateTournament(tournamentId);
  return { ok: true, created: planned.plan.matches.length };
}

async function buildAjustePlanForTournament(
  tournamentId: string,
  bracketSize: number,
  tournament: {
    repescaFee: number | null;
    groupsFinalized: boolean;
    knockoutFillMode: string;
    groupTiebreak?: string;
  },
) {
  const fillMode = parseKnockoutFillMode(tournament.knockoutFillMode);
  const [groups, inscriptions] = await Promise.all([
    prisma.group.findMany({
      where: { tournamentId },
      include: {
        members: { include: { inscription: { include: { player: { select: { name: true } } } } } },
        matches: true,
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.inscription.findMany({
      where: { tournamentId },
      include: { groupMembers: { select: { qualified: true, seed: true } }, player: { select: { name: true } } },
    }),
  ]);

  const reencauchadoIds = new Set(
    inscriptions
      .filter((ins) =>
        isConfirmedRepescaParticipant(ins, tournament.repescaFee, tournament.groupsFinalized, fillMode),
      )
      .map((ins) => ins.id),
  );
  const extras = inscriptions
    .filter((ins) => ins.groupMembers.length === 0 && reencauchadoIds.has(ins.id))
    .map((ins) => ({
      inscriptionId: ins.id,
      distance: ins.distance,
      name: ins.player.name,
    }));

  const groupTiebreak = await readGroupTiebreak(tournamentId);
  const pools = collectAjustePools({
    groups: groups.map((g) => ({
      name: g.name,
      sortOrder: g.sortOrder,
      members: g.members,
      matches: g.matches,
    })),
    reencauchadoIds,
    extraReencauchados: extras,
    groupTiebreak,
  });
  const playedPairs = collectPlayedPairs(groups.flatMap((group) => group.matches));
  const plan = planRondaAjuste({
    bracketSize,
    firsts: pools.firsts,
    seconds: pools.seconds,
    reencauchados: pools.reencauchados,
    playedPairs,
    groupTiebreak,
  });
  if ("error" in plan) return plan;
  return {
    plan,
    firstIds: [...pools.firsts, ...pools.seconds].map((row) => row.inscriptionId),
  };
}

async function assertPlayInSetup(
  tournamentId: string,
  operator: { id: string; role: UserRole },
  bracketSize: number,
) {
  const tournament = await requireTournament(tournamentId, operator.id, operator.role);
  if (!tournament) return { error: "Torneo no encontrado." as const };
  const closed = tournamentClosedMessage(tournament);
  if (closed) return { error: closed };
  if (parseKnockoutFillMode(tournament.knockoutFillMode) !== "PLAY_IN") {
    return { error: "Este torneo no está en modo repesca." as const };
  }
  if (!Number.isInteger(bracketSize) || (bracketSize & (bracketSize - 1)) !== 0) {
    return { error: "Tamaño de cuadro no válido." as const };
  }
  const realKo = await prisma.match.count({ where: realKoWhere(tournamentId) });
  if (realKo > 0) return { error: "Ya hay eliminatoria jugada." as const };
  await syncKoEligibleFromGroups(tournamentId);
  const koCount = await countKoEligible(tournamentId);
  const slotsNeeded = bracketSize - koCount;
  if (slotsNeeded <= 0) {
    return { error: "El cuadro ya tiene todas las plazas ocupadas." as const };
  }
  const playInOpen = await prisma.match.count({
    where: {
      tournamentId,
      phase: "PLAY_IN",
      status: { in: ["SCHEDULED", "LIVE"] },
    },
  });
  if (playInOpen > 0) {
    return {
      error:
        "Cierra o borra los partidos de ajuste pendientes antes de crear otros nuevos." as const,
    };
  }
  return { tournament, slotsNeeded };
}

/** Emparejamientos elegidos por el organizador (eliminados o inscritos sin plaza). */
export async function createPlayInMatchesCustom(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const tournamentId = String(formData.get("tournamentId") ?? "");
  const bracketSize = Number(formData.get("bracketSize") ?? 16);

  const setup = await assertPlayInSetup(tournamentId, operator, bracketSize);
  if ("error" in setup) return setup;
  const { slotsNeeded } = setup;

  const matchCount = Number(formData.get("playInMatchCount") ?? 0);
  if (!Number.isInteger(matchCount) || matchCount < 1 || matchCount > 32) {
    return { error: "Número de partidos de ajuste no válido." };
  }

  const existingPlayIn = await prisma.match.findMany({
    where: { tournamentId, phase: "PLAY_IN" },
    select: { sideAId: true, sideBId: true },
  });
  const busyIds = playInAssignedInscriptionIds(existingPlayIn);

  const pairs: { sideAId: string; sideBId: string; playInKind: string }[] = [];
  for (let i = 0; i < matchCount; i += 1) {
    const sideAId = String(formData.get(`sideA_${i}`) ?? "");
    const sideBId = String(formData.get(`sideB_${i}`) ?? "");
    if (!sideAId || !sideBId) {
      return { error: `Completa los dos jugadores del partido ${i + 1}.` };
    }
    if (sideAId === sideBId) {
      return { error: `El partido ${i + 1} no puede ser contra el mismo jugador.` };
    }
    const playInKind = String(formData.get(`playInKind_${i}`) ?? "");
    pairs.push({ sideAId, sideBId, playInKind });
  }

  const elimMatchCount = pairs.filter((p) => p.playInKind === "ELIM_VS_ELIM").length;
  if (elimMatchCount > slotsNeeded) {
    return {
      error: `Solo hacen falta ${slotsNeeded} duelo${slotsNeeded === 1 ? "" : "s"} repesca vs repesca para los cupos vacíos (marcaste ${elimMatchCount}).`,
    };
  }
  if (elimMatchCount < slotsNeeded) {
    return {
      error: `Faltan ${slotsNeeded - elimMatchCount} duelo${slotsNeeded - elimMatchCount === 1 ? "" : "s"} repesca vs repesca para cubrir los ${slotsNeeded} cupo${slotsNeeded === 1 ? "" : "s"} vacíos antes de generar el cuadro.`,
    };
  }

  const allIds = pairs.flatMap((p) => [p.sideAId, p.sideBId]);
  if (new Set(allIds).size !== allIds.length) {
    return { error: "Un jugador no puede estar en dos partidos de ajuste a la vez." };
  }
  const alreadyBooked = allIds.filter((id) => busyIds.has(id));
  if (alreadyBooked.length > 0) {
    return {
      error:
        "Algún jugador ya está en otro partido de ajuste. Recarga la página y elige solo quien siga disponible.",
    };
  }

  const qualifiedSeedById = new Map(
    (
      await prisma.groupMember.findMany({
        where: { qualified: true, group: { tournamentId }, inscriptionId: { in: allIds } },
        select: { inscriptionId: true, seed: true },
      })
    ).map((r) => [r.inscriptionId, r.seed] as const),
  );

  const groupQualifiedIds = new Set(
    (
      await prisma.groupMember.findMany({
        where: { qualified: true, group: { tournamentId } },
        select: { inscriptionId: true },
      })
    ).map((r) => r.inscriptionId),
  );

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return { error: "Torneo no encontrado." };

  const optedYes = await prisma.inscription.findMany({
    where: {
      tournamentId,
      repescaOptIn: true,
      id: { in: allIds },
    },
    select: { id: true },
  });
  // Sí + no clasificó en grupo = listo para duelo de ajuste (sin exigir cuota de nuevo).
  const repescaOptInIds = new Set(optedYes.map((r) => r.id).filter((id) => !groupQualifiedIds.has(id)));

  const rows = await prisma.inscription.findMany({
    where: { tournamentId, id: { in: allIds } },
    select: { id: true, koEligible: true, distance: true, repescaOptIn: true },
  });
  if (rows.length !== allIds.length) return { error: "Algún jugador no está inscrito en este torneo." };

  const dist = new Map(rows.map((r) => [r.id, r.distance]));

  const maxSlotRow = await prisma.match.aggregate({
    where: { tournamentId, phase: "PLAY_IN" },
    _max: { bracketSlot: true },
  });
  const nextBracketSlot = (maxSlotRow._max.bracketSlot ?? -1) + 1;

  for (let i = 0; i < pairs.length; i += 1) {
    const { sideAId, sideBId, playInKind: kindRaw } = pairs[i];
    const aQual = groupQualifiedIds.has(sideAId);
    const bQual = groupQualifiedIds.has(sideBId);
    const aRep = repescaOptInIds.has(sideAId);
    const bRep = repescaOptInIds.has(sideBId);
    if (aQual || bQual) {
      return {
        error: `Partido ${i + 1}: quien ya clasificó por grupo no juega repesca; ya tiene plaza.`,
      };
    }

    let playInKind = kindRaw;
    if (!playInKind) {
      if (aRep && bRep) playInKind = "ELIM_VS_ELIM";
      else if ((aRep && bQual) || (bRep && aQual)) playInKind = "ELIM_VS_QUALIFIED";
      else playInKind = "QUALIFIED_CONFIRM";
    }

    if (playInKind === "ELIM_VS_ELIM") {
      if (!aRep || !bRep) {
        return {
          error: `Partido ${i + 1}: repesca vs repesca requiere dos jugadores con repesca confirmada.`,
        };
      }
      if (aQual || bQual) {
        return {
          error: `Partido ${i + 1}: en duelos por cupo vacío no uses clasificados de grupo; solo repesca sin plaza aún.`,
        };
      }
    } else if (playInKind === "ELIM_VS_QUALIFIED") {
      const qualId = aQual ? sideAId : bQual ? sideBId : null;
      const repId = aRep ? sideAId : bRep ? sideBId : null;
      if (!qualId || !repId || qualId === repId) {
        return {
          error: `Partido ${i + 1}: repesca vs 2.º debe ser un inscrito en repesca contra un clasificado de grupo.`,
        };
      }
      if (qualifiedSeedById.get(qualId) !== 2) {
        return {
          error: `Partido ${i + 1}: el clasificado debe ser 2.º de su grupo (puede perder el cupo ante repesca).`,
        };
      }
    } else {
      if (aQual && bQual) {
        return { error: `Partido ${i + 1}: no pueden ser dos clasificados de grupo.` };
      }
      if (!aQual && !aRep) {
        return { error: `Partido ${i + 1}: falta un clasificado o repesca confirmada.` };
      }
      if (!bQual && !bRep) {
        return { error: `Partido ${i + 1}: falta un clasificado o repesca confirmada.` };
      }
      if (!aRep && !bRep) {
        return { error: `Partido ${i + 1}: incluye al menos un jugador en repesca.` };
      }
    }

    await prisma.match.create({
      data: {
        tournamentId,
        phase: "PLAY_IN",
        round: 0,
        bracketSlot: nextBracketSlot + i,
        sideAId,
        sideBId,
        distanceA: dist.get(sideAId) ?? 1,
        distanceB: dist.get(sideBId) ?? 1,
        status: "SCHEDULED",
        playInKind,
      },
    });
  }

  revalidateTournament(tournamentId);
  return { ok: true, created: pairs.length };
}

export async function clearPlayInMatches(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const tournamentId = String(formData.get("tournamentId") ?? "");

  const tournament = await requireTournament(tournamentId, operator.id, operator.role);
  if (!tournament) return { error: "Torneo no encontrado." };

  const closed = await prisma.match.count({
    where: { tournamentId, phase: "PLAY_IN", status: { in: ["CLOSED", "WALKOVER"] } },
  });
  if (closed > 0) return { error: "No se pueden borrar repescas ya jugadas." };

  await prisma.match.deleteMany({
    where: { tournamentId, phase: "PLAY_IN" },
  });

  revalidateTournament(tournamentId);
  return { ok: true };
}

export async function setManualKnockoutPicks(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const tournamentId = String(formData.get("tournamentId") ?? "");
  const bracketSize = Number(formData.get("bracketSize") ?? 16);
  const picked = formData.getAll("inscriptionId").map(String);

  const tournament = await requireTournament(tournamentId, operator.id, operator.role);
  if (!tournament) return { error: "Torneo no encontrado." };
  const closed = tournamentClosedMessage(tournament);
  if (closed) return { error: closed };
  if (parseKnockoutFillMode(tournament.knockoutFillMode) !== "MANUAL") {
    return { error: "Este torneo no está en modo manual." };
  }

  const realKo = await prisma.match.count({ where: realKoWhere(tournamentId) });
  if (realKo > 0) return { error: "Ya hay eliminatoria jugada." };

  await syncKoEligibleFromGroups(tournamentId);
  const groupQ = await countGroupQualified(tournamentId);
  const extraNeeded = bracketSize - groupQ;
  if (picked.length !== extraNeeded) {
    return {
      error: `Marca exactamente ${extraNeeded} jugador${extraNeeded === 1 ? "" : "es"} extra para completar ${bracketSize}.`,
    };
  }

  const valid = await prisma.inscription.count({
    where: { tournamentId, id: { in: picked } },
  });
  if (valid !== picked.length) return { error: "Inscripción no válida." };

  const groupQualifiedIds = new Set(
    (
      await prisma.groupMember.findMany({
        where: { qualified: true, group: { tournamentId } },
        select: { inscriptionId: true },
      })
    ).map((r) => r.inscriptionId),
  );

  if (picked.some((id) => groupQualifiedIds.has(id))) {
    return { error: "No marques a quien ya clasificó por grupo; solo plazas extra." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.inscription.updateMany({
      where: { tournamentId },
      data: { koManualPick: false },
    });
    await tx.inscription.updateMany({
      where: { id: { in: picked } },
      data: { koEligible: true, koManualPick: true },
    });
  });

  const total = await countKoEligible(tournamentId);
  revalidateTournament(tournamentId);
  return { ok: true, total };
}

/** Modo repesca: asignar plazas restantes sin partido (pase directo del organizador). */
export async function assignDirectBracketSlots(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const tournamentId = String(formData.get("tournamentId") ?? "");
  const bracketSize = Number(formData.get("bracketSize") ?? 16);
  const picked = formData.getAll("inscriptionId").map(String);

  const tournament = await requireTournament(tournamentId, operator.id, operator.role);
  if (!tournament) return { error: "Torneo no encontrado." };
  const closed = tournamentClosedMessage(tournament);
  if (closed) return { error: closed };
  if (parseKnockoutFillMode(tournament.knockoutFillMode) !== "PLAY_IN") {
    return { error: "El pase directo en repesca solo aplica con modo repesca." };
  }

  const realKo = await prisma.match.count({ where: realKoWhere(tournamentId) });
  if (realKo > 0) return { error: "Ya hay eliminatoria jugada." };

  if (picked.length === 0) {
    return { error: "Elige al menos un jugador para el pase directo." };
  }
  if (new Set(picked).size !== picked.length) {
    return { error: "No repitas jugadores." };
  }

  await syncKoEligibleFromGroups(tournamentId);
  const koCount = await countKoEligible(tournamentId);
  const slotsStillNeeded = bracketSize - koCount;
  if (slotsStillNeeded <= 0) {
    return { error: "El cuadro ya está completo." };
  }
  if (picked.length > slotsStillNeeded) {
    return {
      error: `Solo faltan ${slotsStillNeeded} plaza${slotsStillNeeded === 1 ? "" : "s"}; marcaste ${picked.length}.`,
    };
  }

  const rows = await prisma.inscription.findMany({
    where: { tournamentId, id: { in: picked } },
    select: { id: true, koEligible: true },
  });
  if (rows.length !== picked.length) return { error: "Inscripción no válida." };
  if (rows.some((r) => r.koEligible)) {
    return { error: "Alguno ya tiene plaza en el cuadro." };
  }

  const groupQualifiedIds = new Set(
    (
      await prisma.groupMember.findMany({
        where: { qualified: true, group: { tournamentId }, inscriptionId: { in: picked } },
        select: { inscriptionId: true },
      })
    ).map((r) => r.inscriptionId),
  );
  if (groupQualifiedIds.size > 0) {
    return {
      error: "No uses pase directo para quien ya clasificó por grupo (debería tener plaza).",
    };
  }

  await prisma.inscription.updateMany({
    where: { id: { in: picked } },
    data: { koEligible: true, koManualPick: true },
  });

  const total = await countKoEligible(tournamentId);
  revalidateTournament(tournamentId);
  return { ok: true, total };
}
