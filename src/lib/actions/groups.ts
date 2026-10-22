"use server";

import { memberGroupStats, planKnockout } from "@/lib/bracket";
import { qualificationFromStanding } from "@/lib/group-standing";
import { readGroupTiebreak } from "@/lib/group-tiebreak-db";
import { appendNewMemberMatches, groupRoundRobinRows, replaceGroupRoundRobin } from "@/lib/group-matches";
import { loadGroupMemberContext, loadGroupStructureContext } from "@/lib/group-structure";
import {
  balancedGroupFill,
  groupName,
  nextGroupName,
  partitionGroupSizes,
  resolveGroupCount,
  shuffle,
} from "@/lib/groups";
import { placeWinnerInNext, realKoWhere } from "@/lib/ko";
import { prisma } from "@/lib/prisma";
import { revalidateTournament } from "@/lib/revalidate";
import { requireOrganizerOrAdmin } from "@/lib/session-user";
import { ownedGroupWhere } from "@/lib/tournament-access";
import { requireTournament, tournamentClosedMessage } from "@/lib/session";
import {
  buildKnockoutPlayerList,
  parseKnockoutDrawMode,
  parseKnockoutFillMode,
  shuffleBracketPlayers,
  syncKoEligibleFromGroups,
} from "@/lib/knockout-entry";
import { syncGroupQualification } from "@/lib/qualification";
import { groupHasPlayedMatches, inscriptionHasPlayed } from "@/lib/group-play";

async function loadInscriptionsForGroups(
  tournamentId: string,
  onlyCheckedIn: boolean,
) {
  return prisma.inscription.findMany({
    where: {
      tournamentId,
      ...(onlyCheckedIn ? { checkedIn: true } : {}),
    },
    include: { player: { omit: { photoData: true } } },
    orderBy: { createdAt: "asc" },
  });
}

async function wipeDraftGroups(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], tournamentId: string) {
  await tx.match.deleteMany({ where: { tournamentId, phase: "GROUP" } });
  await tx.group.deleteMany({ where: { tournamentId } });
}

export async function prepareGroupStructure(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const tournamentId = String(formData.get("tournamentId") ?? "");
  const onlyCheckedIn = formData.get("onlyCheckedIn") === "on";
  const autoFill = formData.get("autoFill") !== "off";

  const ctx = await loadGroupStructureContext(tournamentId, operator.id, operator.role);
  if ("error" in ctx) return { error: ctx.error };
  const { tournament } = ctx;

  const inscriptions = await loadInscriptionsForGroups(tournamentId, onlyCheckedIn);
  const groupCountRes = resolveGroupCount(
    inscriptions.length,
    tournament.groupSize,
    tournament.plannedCapacity,
  );
  if ("error" in groupCountRes) return { error: groupCountRes.error };
  const groupCount = groupCountRes.count;

  const fill = autoFill
    ? balancedGroupFill(inscriptions.length, groupCount, tournament.groupSize)
    : { sizes: Array.from({ length: groupCount }, () => 0) };
  if ("error" in fill) return { error: fill.error };

  if (tournament.knockoutPreDraw) {
    const { validatePredrawBracket } = await import("@/lib/bracket-predraw");
    const check = validatePredrawBracket(
      groupCount,
      tournament.qualifyPerGroup,
      parseKnockoutFillMode(tournament.knockoutFillMode),
    );
    if ("error" in check) return { error: check.error };
  }

  const ordered = autoFill ? shuffle(inscriptions) : [];
  let cursor = 0;
  const tables = await prisma.table.findMany({
    where: { tournamentId },
    orderBy: { number: "asc" },
    select: { id: true },
  });

  await prisma.$transaction(
    async (tx) => {
    await wipeDraftGroups(tx, tournamentId);

    for (let i = 0; i < groupCount; i += 1) {
      const take = fill.sizes[i] ?? 0;
      const slice = ordered.slice(cursor, cursor + take);
      cursor += take;

      await tx.group.create({
        data: {
          tournamentId,
          name: groupName(i),
          sortOrder: i,
          maxMembers: tournament.groupSize,
          tableId: tables.length > 0 ? tables[i % tables.length].id : null,
          members: {
            create: slice.map((ins) => ({ inscriptionId: ins.id })),
          },
        },
      });
    }

    await tx.tournament.update({
      where: { id: tournamentId },
      data: { groupsFinalized: false, status: tournament.status === "DRAFT" ? "REGISTRATION" : tournament.status },
    });
    },
    { maxWait: 15_000, timeout: 30_000 },
  );

  revalidateTournament(tournamentId);
  return { ok: true, groupCount, bench: inscriptions.length - cursor };
}

/** Agrega un grupo vacío sin tocar los que ya están armados. */
export async function addEmptyGroup(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const tournamentId = String(formData.get("tournamentId") ?? "");

  const ctx = await loadGroupMemberContext(tournamentId, operator.id, operator.role);
  if ("error" in ctx) return { error: ctx.error };
  const { tournament } = ctx;

  const [groups, koCount, tables] = await Promise.all([
    prisma.group.findMany({
      where: { tournamentId },
      select: { name: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.match.count({
      where: { tournamentId, phase: { in: ["KO", "PLAY_IN"] } },
    }),
    prisma.table.findMany({
      where: { tournamentId },
      orderBy: { number: "asc" },
      select: { id: true },
    }),
  ]);

  if (groups.length === 0) {
    return { error: "Primero crea la estructura de grupos." };
  }
  if (koCount > 0) {
    return { error: "El cuadro ya está armado. No se puede agregar un grupo." };
  }

  if (tournament.knockoutPreDraw) {
    const { validatePredrawBracket } = await import("@/lib/bracket-predraw");
    const check = validatePredrawBracket(
      groups.length + 1,
      tournament.qualifyPerGroup,
      parseKnockoutFillMode(tournament.knockoutFillMode),
    );
    if ("error" in check) return { error: check.error };
  }

  const sortOrder = Math.max(...groups.map((g) => g.sortOrder)) + 1;
  const name = nextGroupName(groups.map((g) => g.name));

  await prisma.group.create({
    data: {
      tournamentId,
      name,
      sortOrder,
      maxMembers: tournament.groupSize,
      tableId: tables.length > 0 ? tables[sortOrder % tables.length].id : null,
      status: "OPEN",
    },
  });

  revalidateTournament(tournamentId);
  return { ok: true, name };
}

export async function shuffleUnassignedIntoGroups(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const tournamentId = String(formData.get("tournamentId") ?? "");

  const ctx = await loadGroupStructureContext(tournamentId, operator.id, operator.role);
  if ("error" in ctx) return { error: ctx.error };
  const { tournament } = ctx;

  const [groups, bench] = await Promise.all([
    prisma.group.findMany({
      where: { tournamentId },
      include: { members: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.inscription.findMany({
      where: { tournamentId, groupMembers: { none: {} } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (groups.length === 0) return { error: "Primero crea la estructura de grupos." };
  if (bench.length === 0) return { error: "No hay jugadores sin grupo." };

  const shuffled = shuffle(bench);
  const assignments: { inscriptionId: string; groupId: string }[] = [];

  for (const ins of shuffled) {
    const target = groups
      .filter((g) => g.members.length < g.maxMembers)
      .sort((a, b) => a.members.length - b.members.length)[0];
    if (!target) break;
    assignments.push({ inscriptionId: ins.id, groupId: target.id });
    target.members.push({ inscriptionId: ins.id } as (typeof target.members)[number]);
  }

  await prisma.$transaction(async (tx) => {
    for (const row of assignments) {
      await tx.groupMember.create({
        data: { groupId: row.groupId, inscriptionId: row.inscriptionId },
      });
    }
  });

  revalidateTournament(tournamentId);
  return { ok: true, assigned: assignments.length };
}

export async function assignInscriptionToGroup(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const tournamentId = String(formData.get("tournamentId") ?? "");
  const groupId = String(formData.get("groupId") ?? "");
  const inscriptionId = String(formData.get("inscriptionId") ?? "");

  const ctx = await loadGroupMemberContext(tournamentId, operator.id, operator.role);
  if ("error" in ctx) return { error: ctx.error };
  const { tournament } = ctx;

  const [group, inscription] = await Promise.all([
    prisma.group.findFirst({
      where: { id: groupId, tournamentId },
      include: { members: { include: { inscription: { select: { distance: true } } } } },
    }),
    prisma.inscription.findFirst({
      where: { id: inscriptionId, tournamentId },
      include: { groupMembers: true },
    }),
  ]);
  if (!group || !inscription) return { error: "Grupo o inscripción no encontrados." };

  const currentGroupId = inscription.groupMembers[0]?.groupId ?? null;
  if (await inscriptionHasPlayed(inscriptionId, tournamentId)) {
    return { error: "Ese jugador ya jugó. No se puede mover de grupo." };
  }
  if (currentGroupId && currentGroupId !== groupId && (await groupHasPlayedMatches(currentGroupId))) {
    return { error: "Su grupo ya tiene partidos jugados. No se puede mover." };
  }
  const targetHasPlayed = await groupHasPlayedMatches(groupId);

  if (inscription.groupMembers.some((m) => m.groupId !== groupId)) {
    await prisma.groupMember.deleteMany({ where: { inscriptionId } });
  }
  if (group.members.some((m) => m.inscriptionId === inscriptionId)) {
    return { ok: true };
  }
  if (group.members.length >= group.maxMembers) {
    return { error: `${group.name} ya está lleno (${group.maxMembers} plazas).` };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.groupMember.create({ data: { groupId, inscriptionId } });
      if (tournament.groupsFinalized) {
        if (targetHasPlayed) {
          await appendNewMemberMatches(
            tx,
            groupId,
            tournamentId,
            { id: inscriptionId, distance: inscription.distance },
            group.members.map((m) => ({
              id: m.inscriptionId,
              distance: m.inscription.distance,
            })),
          );
        } else {
          const members = await tx.groupMember.findMany({
            where: { groupId },
            include: { inscription: true },
          });
          const rebuilt = await replaceGroupRoundRobin(
            tx,
            groupId,
            tournamentId,
            members.map((m) => ({ id: m.inscriptionId, distance: m.inscription.distance })),
          );
          if ("error" in rebuilt) throw new Error(rebuilt.error);
        }
        await tx.group.update({
          where: { id: groupId },
          data: { status: "OPEN", tiebreakNote: null },
        });
        await tx.groupMember.updateMany({
          where: { groupId },
          data: { qualified: false, seed: null },
        });
      }
    });
  } catch (err) {
    console.error("assignInscriptionToGroup", err);
    return { error: "No se pudo meter al grupo. Recarga e inténtalo de nuevo." };
  }

  if (tournament.groupsFinalized) await syncGroupQualification(tournamentId);
  revalidateTournament(tournamentId);
  return { ok: true };
}

export async function moveInscriptionToGroup(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const tournamentId = String(formData.get("tournamentId") ?? "");
  const inscriptionId = String(formData.get("inscriptionId") ?? "");
  const groupId = String(formData.get("groupId") ?? "");

  const ctx = await loadGroupStructureContext(tournamentId, operator.id, operator.role);
  if ("error" in ctx) return { error: ctx.error };

  const fd = new FormData();
  fd.set("tournamentId", tournamentId);
  fd.set("inscriptionId", inscriptionId);
  fd.set("groupId", groupId);
  return assignInscriptionToGroup(fd);
}

export async function removeInscriptionFromGroup(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const tournamentId = String(formData.get("tournamentId") ?? "");
  const inscriptionId = String(formData.get("inscriptionId") ?? "");

  const ctx = await loadGroupStructureContext(tournamentId, operator.id, operator.role);
  if ("error" in ctx) return { error: ctx.error };

  const member = await prisma.groupMember.findFirst({
    where: { inscriptionId, group: { tournamentId } },
    include: { group: true },
  });
  if (!member) return { error: "Ese jugador no está en un grupo." };
  if (await inscriptionHasPlayed(inscriptionId, tournamentId)) {
    return { error: "Ese jugador ya jugó. No se puede sacar del grupo." };
  }

  await prisma.groupMember.delete({ where: { id: member.id } });
  revalidateTournament(tournamentId);
  return { ok: true };
}

export async function finalizeGroups(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const tournamentId = String(formData.get("tournamentId") ?? "");

  const existing = await requireTournament(tournamentId, operator.id, operator.role);
  if (!existing) return { error: "Torneo no encontrado." };
  if (existing.status === "CLOSED") return { error: "El torneo ya está finalizado." };
  if (existing.groupsFinalized) {
    revalidateTournament(tournamentId);
    return { ok: true };
  }

  const ctx = await loadGroupStructureContext(tournamentId, operator.id, operator.role);
  if ("error" in ctx) return { error: ctx.error };
  const { tournament } = ctx;

  const groups = await prisma.group.findMany({
    where: { tournamentId },
    include: { members: { include: { inscription: true } } },
    orderBy: { sortOrder: "asc" },
  });
  if (groups.length === 0) return { error: "No hay grupos. Crea la estructura primero." };

  const withPlayers = groups.filter((g) => g.members.length >= 2);
  if (withPlayers.length === 0) {
    return { error: "Hace falta al menos un grupo con 2 o más jugadores para generar partidos." };
  }

  if (tournament.knockoutPreDraw) {
    const { validatePredrawBracket } = await import("@/lib/bracket-predraw");
    const check = validatePredrawBracket(
      withPlayers.length,
      tournament.qualifyPerGroup,
      parseKnockoutFillMode(tournament.knockoutFillMode),
    );
    if ("error" in check) return { error: check.error };
  }

  const matchRows = withPlayers.flatMap((group) =>
    groupRoundRobinRows(
      tournamentId,
      group.id,
      group.members.map((m) => ({
        id: m.inscriptionId,
        distance: m.inscription.distance,
      })),
    ),
  );

  try {
    await prisma.match.deleteMany({ where: { tournamentId, phase: "GROUP" } });
    if (matchRows.length > 0) {
      await prisma.match.createMany({ data: matchRows });
    }
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { groupsFinalized: true, status: "LIVE" },
    });
  } catch (err) {
    console.error("finalizeGroups", err);
    return { error: "No se pudieron generar los partidos. Recarga e inténtalo de nuevo." };
  }

  if (tournament.knockoutPreDraw) {
    const { createPredrawnKnockoutForTournament } = await import("@/lib/predraw-knockout");
    const built = await createPredrawnKnockoutForTournament(tournamentId);
    if ("error" in built && built.error) return { error: built.error };
  }

  revalidateTournament(tournamentId);
  return { ok: true };
}

export async function closeGroupAsFull(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const groupId = String(formData.get("groupId") ?? "");

  const group = await prisma.group.findFirst({
    where: ownedGroupWhere(groupId, operator.id, operator.role),
    include: { members: true, matches: true, tournament: true },
  });
  if (!group) return { error: "Grupo no encontrado." };
  const closed = tournamentClosedMessage(group.tournament);
  if (closed) return { error: closed };

  const played = group.matches.some(
    (m) => m.status === "CLOSED" || m.status === "WALKOVER" || m.status === "LIVE",
  );
  if (played) {
    return {
      error:
        "Este grupo ya tiene partidos jugados. Usa la clasificación normal o cierra los resultados pendientes.",
    };
  }

  const n = group.members.length;
  const q = group.tournament.qualifyPerGroup;
  if (n === 0) return { error: "El grupo está vacío." };
  if (n > q) {
    return {
      error: `Hay ${n} jugadores y solo clasifican ${q}. Pulsa «Generar partidos» o cierra resultados antes de cerrar el grupo.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.deleteMany({ where: { groupId: group.id, phase: "GROUP" } });
    await tx.group.update({
      where: { id: group.id },
      data: { status: "RESOLVED", tiebreakNote: "sin_mas_inscripciones" },
    });
    for (let i = 0; i < group.members.length; i += 1) {
      const member = group.members[i];
      await tx.groupMember.update({
        where: { id: member.id },
        data: { qualified: true, seed: i + 1 },
      });
    }
  });

  await syncKoEligibleFromGroups(group.tournamentId);
  revalidateTournament(group.tournamentId);
  return { ok: true };
}

/** Borra grupos y partidos de fase de grupos para volver al armado manual (sin KO jugado). */
export async function reopenGroupSetup(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const tournamentId = String(formData.get("tournamentId") ?? "");

  const tournament = await requireTournament(tournamentId, operator.id, operator.role);
  if (!tournament) return { error: "Torneo no encontrado." };
  const closed = tournamentClosedMessage(tournament);
  if (closed) return { error: closed };

  const koPlayed = await prisma.match.count({
    where: {
      tournamentId,
      phase: "KO",
      status: { in: ["CLOSED", "WALKOVER", "LIVE"] },
      NOT: { closeReason: "bye" },
    },
  });
  if (koPlayed > 0) return { error: "La eliminatoria ya empezó. No se puede reabrir grupos." };

  const closedGroup = await prisma.match.count({
    where: {
      tournamentId,
      phase: "GROUP",
      status: { in: ["CLOSED", "WALKOVER"] },
      NOT: { closeReason: "bye" },
    },
  });
  if (closedGroup > 0) {
    return {
      error: "Ya hay resultados de grupos. No se puede reabrir el armado.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.deleteMany({ where: { tournamentId, phase: { in: ["GROUP", "KO", "PLAY_IN"] } } });
    await tx.group.deleteMany({ where: { tournamentId } });
    await tx.inscription.updateMany({
      where: { tournamentId },
      data: { koEligible: false, koManualPick: false },
    });
    await tx.tournament.update({
      where: { id: tournamentId },
      data: { groupsFinalized: false, status: "REGISTRATION" },
    });
  });

  revalidateTournament(tournamentId);
  return { ok: true };
}

/** Sorteo rápido: reparte al azar y genera partidos (comportamiento anterior). */
export async function generateGroups(formData: FormData) {
  const prepared = await prepareGroupStructure(formData);
  if ("error" in prepared && prepared.error) return prepared;

  const tournamentId = String(formData.get("tournamentId") ?? "");
  const finalized = await finalizeGroups(
    (() => {
      const fd = new FormData();
      fd.set("tournamentId", tournamentId);
      return fd;
    })(),
  );
  if (finalized.error) return finalized;
  return { ok: true };
}

export async function resolveGroupTie(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const groupId = String(formData.get("groupId") ?? "");
  const note = String(formData.get("note") ?? "").trim() || "penaltis";
  const selected = formData.getAll("inscriptionId").map(String);

  const group = await prisma.group.findFirst({
    where: ownedGroupWhere(groupId, operator.id, operator.role),
    include: { members: true, matches: true, tournament: true },
  });
  if (!group) return { error: "Grupo no encontrado." };
  const closedTie = tournamentClosedMessage(group.tournament);
  if (closedTie) return { error: closedTie };
  if (group.status !== "TIE") return { error: "Este grupo no está empatado." };

  const mode = await readGroupTiebreak(group.tournamentId);
  const rows = group.members.map((member) => ({
    inscriptionId: member.inscriptionId,
    groupSort: group.sortOrder,
    ...memberGroupStats(member.inscriptionId, group.matches),
  }));
  const { auto, tie, spots } = qualificationFromStanding(
    rows,
    group.tournament.qualifyPerGroup,
    mode,
  );

  if (selected.length !== spots) {
    return { error: `Marca exactamente ${spots} jugador${spots === 1 ? "" : "es"} para clasificar.` };
  }
  if (selected.some((id) => !tie.some((t) => t.inscriptionId === id))) {
    return { error: "Solo puedes marcar a los empatados." };
  }

  const qualifiedIds = [...auto.map((a) => a.inscriptionId), ...selected];

  await prisma.$transaction(async (tx) => {
    await tx.group.update({
      where: { id: group.id },
      data: { status: "RESOLVED", tiebreakNote: note },
    });
    for (const member of group.members) {
      const seed = qualifiedIds.indexOf(member.inscriptionId);
      await tx.groupMember.update({
        where: { id: member.id },
        data: { qualified: seed >= 0, seed: seed >= 0 ? seed + 1 : null },
      });
    }
  });

  await syncKoEligibleFromGroups(group.tournamentId);
  revalidateTournament(group.tournamentId);
  return { ok: true };
}

export async function generateKnockout(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const tournamentId = String(formData.get("tournamentId") ?? "");

  const tournament = await requireTournament(tournamentId, operator.id, operator.role);
  if (!tournament) return { error: "Torneo no encontrado." };
  const closedKo = tournamentClosedMessage(tournament);
  if (closedKo) return { error: closedKo };

  const groups = await prisma.group.findMany({
    where: { tournamentId },
    include: {
      members: { include: { inscription: true } },
      matches: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  if (tournament.knockoutPreDraw) {
    return {
      error:
        "Este torneo usa cuadro prefijado: ya se creó al generar los partidos de grupos. Revisa la pestaña Cuadro.",
    };
  }

  if (groups.length === 0) return { error: "Primero arma los grupos." };
  if (groups.some((g) => g.status !== "RESOLVED")) {
    return { error: "Termina los grupos y resuelve los empates antes de armar el cuadro." };
  }

  const realKo = await prisma.match.count({ where: realKoWhere(tournamentId) });
  if (realKo > 0) {
    return { error: "El cuadro ya tiene partidos jugados. No se puede regenerar." };
  }

  const bracketSizeRaw = formData.get("bracketSize");
  const bracketSizeTrimmed =
    bracketSizeRaw != null ? String(bracketSizeRaw).trim() : "";
  let bracketSize: number | undefined;
  if (bracketSizeTrimmed !== "") {
    const parsed = Number(bracketSizeTrimmed);
    if (!Number.isInteger(parsed) || parsed < 4 || parsed > 64 || (parsed & (parsed - 1)) !== 0) {
      return { error: "El tamaño del cuadro debe ser 4, 8, 16, 32 o 64." };
    }
    bracketSize = parsed;
  }

  const fillMode = parseKnockoutFillMode(tournament.knockoutFillMode);
  const drawMode = parseKnockoutDrawMode(tournament.knockoutDrawMode);

  if (fillMode !== "AUTO") {
    await syncKoEligibleFromGroups(tournamentId);
  }

  const built = await buildKnockoutPlayerList(tournamentId, fillMode, bracketSize);
  if (built.error) return { error: built.error };
  if (built.players.length < 2) {
    return { error: "Hacen falta al menos dos jugadores con plaza en el cuadro." };
  }

  let players = built.players;
  if (fillMode !== "PLAY_IN" && (drawMode === "SHUFFLE_R1" || drawMode === "SHUFFLE_EACH")) {
    players = shuffleBracketPlayers(players);
  }

  const firstRoundOnly = drawMode === "SHUFFLE_EACH";
  const { plans } = planKnockout(players, { firstRoundOnly, size: bracketSize });

  try {
    await prisma.match.deleteMany({ where: { tournamentId, phase: "KO" } });
    if (plans.length > 0) {
      await prisma.match.createMany({
        data: plans.map((plan) => {
          const winner = plan.isBye ? (plan.sideA ?? plan.sideB) : null;
          return {
            tournamentId,
            phase: "KO" as const,
            round: plan.round,
            bracketSlot: plan.slot,
            sideAId: plan.sideA?.inscriptionId ?? null,
            sideBId: plan.sideB?.inscriptionId ?? null,
            distanceA: plan.sideA?.distance ?? 1,
            distanceB: plan.sideB?.distance ?? 1,
            status: plan.isBye ? "CLOSED" : "SCHEDULED",
            winnerId: winner?.inscriptionId ?? null,
            closeReason: plan.isBye ? "bye" : null,
          };
        }),
      });
    }

    const created = await prisma.match.findMany({
      where: { tournamentId, phase: "KO" },
      select: { id: true, round: true, bracketSlot: true },
    });
    const idByKey = new Map(created.map((row) => [`${row.round}-${row.bracketSlot}`, row.id]));
    const distances = new Map(players.map((p) => [p.inscriptionId, p.distance]));

    if (!firstRoundOnly) {
      for (const plan of plans) {
        if (plan.nextRound == null || plan.nextSlot == null) continue;
        const fromId = idByKey.get(`${plan.round}-${plan.slot}`);
        const toId = idByKey.get(`${plan.nextRound}-${plan.nextSlot}`);
        if (!fromId || !toId) continue;
        await prisma.match.update({
          where: { id: fromId },
          data: { nextMatchId: toId, nextSide: plan.nextSide },
        });
      }

      for (const plan of plans) {
        if (!plan.isBye) continue;
        const winner = plan.sideA ?? plan.sideB;
        if (!winner || plan.nextRound == null || plan.nextSlot == null) continue;
        await placeWinnerInNext(
          prisma,
          idByKey.get(`${plan.nextRound}-${plan.nextSlot}`) ?? null,
          plan.nextSide,
          winner.inscriptionId,
          distances.get(winner.inscriptionId) ?? winner.distance,
        );
      }
    }
  } catch (err) {
    console.error("generateKnockout", err);
    return { error: "No se pudo armar el cuadro. Recarga e inténtalo de nuevo." };
  }

  revalidateTournament(tournamentId);
  return { ok: true };
}

export async function setGroupTable(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const groupId = String(formData.get("groupId") ?? "");
  const tableId = String(formData.get("tableId") ?? "") || null;

  const group = await prisma.group.findFirst({
    where: ownedGroupWhere(groupId, operator.id, operator.role),
    include: { tournament: true },
  });
  if (!group) return { error: "Grupo no encontrado." };
  const closed = tournamentClosedMessage(group.tournament);
  if (closed) return { error: closed };

  if (tableId) {
    const table = await prisma.table.findFirst({
      where: { id: tableId, tournamentId: group.tournamentId },
    });
    if (!table) return { error: "Mesa no encontrada." };
  }

  await prisma.group.update({
    where: { id: groupId },
    data: { tableId },
  });
  revalidateTournament(group.tournamentId);
  return { ok: true };
}
