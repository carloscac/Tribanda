"use server";

import { revalidatePath } from "next/cache";
import { dropKnockoutIfIdle, syncGroupQualification } from "@/lib/qualification";
import { clearWinnerFromNext, placeWinnerInNext, realKoWhere } from "@/lib/ko";
import { prisma } from "@/lib/prisma";
import { revalidateTournament } from "@/lib/revalidate";
import { decideWinner, inningsForDecision, isFinished, parseScore, validateParsedScore } from "@/lib/scoring";
import { notifyMatchOnTable } from "@/lib/notifications";
import { maybeAdvanceShuffleKnockoutRound } from "@/lib/knockout-shuffle-round";
import { requireOrganizerOrAdmin } from "@/lib/session-user";
import { ownedMatchWhere } from "@/lib/tournament-access";
import { requireTournament, tournamentClosedMessage } from "@/lib/session";
import type { UserRole } from "@/lib/roles";

const matchInclude = {
  sideA: { include: { player: { omit: { photoData: true } }, category: true } },
  sideB: { include: { player: { omit: { photoData: true } }, category: true } },
  table: true,
} as const;

async function ownedMatch(matchId: string, operator: { id: string; role: UserRole }) {
  const match = await prisma.match.findFirst({
    where: ownedMatchWhere(matchId, operator.id, operator.role),
    include: { ...matchInclude, tournament: { omit: { imageData: true } } },
  });
  return match;
}

function playerIds(match: { sideAId: string | null; sideBId: string | null }) {
  return [match.sideAId, match.sideBId].filter(Boolean) as string[];
}

export async function assignNextMatches(tournamentId: string) {
  const operator = await requireOrganizerOrAdmin();
  const tournament = await requireTournament(tournamentId, operator.id, operator.role);
  if (!tournament) return { error: "Torneo no encontrado." };
  const closedAssign = tournamentClosedMessage(tournament);
  if (closedAssign) return { error: closedAssign };

  const [tables, live, queued, groups] = await Promise.all([
    prisma.table.findMany({
      where: { tournamentId },
      orderBy: { number: "asc" },
    }),
    prisma.match.findMany({
      where: { tournamentId, status: "LIVE" },
    }),
    prisma.match.findMany({
      where: {
        tournamentId,
        status: "SCHEDULED",
        tableId: null,
        sideAId: { not: null },
        sideBId: { not: null },
      },
      orderBy: [{ phase: "desc" }, { round: "asc" }, { createdAt: "asc" }],
    }),
    prisma.group.findMany({
      where: { tournamentId },
      select: { id: true, tableId: true },
    }),
  ]);

  const groupTable = new Map(
    groups.filter((g) => g.tableId).map((g) => [g.id, g.tableId!]),
  );
  const busyTables = new Set(live.map((m) => m.tableId).filter(Boolean));
  const busyPlayers = new Set(live.flatMap(playerIds));
  const freeTables = tables.filter((t) => !busyTables.has(t.id));
  const remaining = [...queued];

  for (const table of freeTables) {
    const idx = remaining.findIndex((match) => {
      const ids = playerIds(match);
      if (ids.some((id) => busyPlayers.has(id))) return false;
      if (match.phase === "GROUP" && match.groupId) {
        const fixed = groupTable.get(match.groupId);
        if (fixed && fixed !== table.id) return false;
      }
      return true;
    });
    if (idx < 0) continue;
    const match = remaining.splice(idx, 1)[0];
    const ids = playerIds(match);

    await prisma.match.update({
      where: { id: match.id },
      data: {
        tableId: table.id,
        status: "LIVE",
        paused: false,
        liveStartedAt: match.liveStartedAt ?? new Date(),
      },
    });
    await notifyMatchOnTable(match.id);
    ids.forEach((id) => busyPlayers.add(id));
  }

  revalidateTournament(tournamentId);
  return { ok: true };
}

export async function assignMatchToTable(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  const tableId = String(formData.get("tableId") ?? "");

  const match = await ownedMatch(matchId, operator);
  if (!match) return { error: "Partido no encontrado." };
  const closedTable = tournamentClosedMessage(match.tournament);
  if (closedTable) return { error: closedTable };
  if (isFinished(match.status)) return { error: "Ese partido ya está cerrado." };
  if (!match.sideAId || !match.sideBId) {
    return { error: "Ese cruce todavía no tiene ambos jugadores." };
  }

  const table = await prisma.table.findFirst({
    where: { id: tableId, tournamentId: match.tournamentId },
  });
  if (!table) return { error: "Mesa no encontrada." };

  if (match.phase === "GROUP" && match.groupId) {
    const group = await prisma.group.findFirst({
      where: { id: match.groupId },
      select: { tableId: true, name: true, table: { select: { number: true } } },
    });
    if (group?.tableId && group.tableId !== tableId) {
      return {
        error: `${group.name} juega en la mesa ${group.table?.number ?? "fija"}. No se puede poner en otra.`,
      };
    }
  }

  const occupied = await prisma.match.findFirst({
    where: { tableId, status: "LIVE", id: { not: match.id } },
    include: {
      sideA: { include: { player: { omit: { photoData: true } } } },
      sideB: { include: { player: { omit: { photoData: true } } } },
    },
  });
  if (occupied) {
    const a = occupied.sideA?.player.name ?? "—";
    const b = occupied.sideB?.player.name ?? "—";
    return {
      error: `La mesa ${table.number} ya está en uso (${a} vs ${b}). Elige otra mesa o libera esa mesa primero.`,
    };
  }

  const live = await prisma.match.findMany({
    where: { tournamentId: match.tournamentId, status: "LIVE", id: { not: match.id } },
  });
  const busyPlayers = new Set(live.flatMap(playerIds));
  if (playerIds(match).some((id) => busyPlayers.has(id))) {
    return { error: "Uno de los jugadores ya está en otra mesa." };
  }

  await prisma.match.update({
    where: { id: match.id },
    data: {
      tableId,
      status: "LIVE",
      paused: false,
      liveStartedAt: match.liveStartedAt ?? new Date(),
    },
  });

  await notifyMatchOnTable(match.id);
  revalidateTournament(match.tournamentId);
  return { ok: true };
}

export async function resendMatchTableAlerts(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const matchId = String(formData.get("matchId") ?? "");

  const match = await ownedMatch(matchId, operator);
  if (!match) return { error: "Partido no encontrado." };
  if (match.status !== "LIVE" || !match.tableId) {
    return { error: "Solo puedes reenviar avisos de un partido que está en mesa." };
  }

  await notifyMatchOnTable(match.id, { resend: true });
  revalidateTournament(match.tournamentId);
  revalidatePath("/participante");
  return { ok: true };
}

export async function releaseTable(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  const match = await ownedMatch(matchId, operator);
  if (!match) return { error: "Partido no encontrado." };
  const closedRelease = tournamentClosedMessage(match.tournament);
  if (closedRelease) return { error: closedRelease };
  if (isFinished(match.status)) return { error: "No se puede soltar un partido cerrado." };

  await prisma.match.update({
    where: { id: match.id },
    data: { tableId: null, status: "SCHEDULED" },
  });

  revalidateTournament(match.tournamentId);
  return { ok: true };
}

export async function saveMatchProgress(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  const match = await ownedMatch(matchId, operator);
  if (!match) return { error: "Partido no encontrado." };
  const closedSave = tournamentClosedMessage(match.tournament);
  if (closedSave) return { error: closedSave };
  if (isFinished(match.status)) return { error: "El partido ya está cerrado. Reábrelo para corregir." };

  const score = parseScore(formData);
  const scoreError = validateParsedScore(score, match.tournament.requireInnings);
  if (scoreError) return { error: scoreError };

  await prisma.match.update({
    where: { id: match.id },
    data: {
      caromsA: score.caromsA,
      caromsB: score.caromsB,
      innings: score.innings,
      highRunA: Number.isNaN(score.highRunA as number) ? null : score.highRunA,
      highRunB: Number.isNaN(score.highRunB as number) ? null : score.highRunB,
      status: match.tableId ? "LIVE" : "SCHEDULED",
    },
  });

  revalidateTournament(match.tournamentId);
  return { ok: true };
}

export async function closeMatch(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  const match = await ownedMatch(matchId, operator);
  if (!match) return { error: "Partido no encontrado." };
  const closedFinish = tournamentClosedMessage(match.tournament);
  if (closedFinish) return { error: closedFinish };
  if (isFinished(match.status)) return { error: "Ya está cerrado." };
  if (!match.sideAId || !match.sideBId) return { error: "El partido no tiene ambos jugadores." };

  const score = parseScore(formData);
  const scoreError = validateParsedScore(score, match.tournament.requireInnings);
  if (scoreError) return { error: scoreError };
  if (score.highRunA != null && (Number.isNaN(score.highRunA) || score.highRunA < 0)) {
    return { error: "La tacada mayor del primero no es válida." };
  }
  if (score.highRunB != null && (Number.isNaN(score.highRunB) || score.highRunB < 0)) {
    return { error: "La tacada mayor del segundo no es válida." };
  }
  if (score.highRunA != null && score.highRunA > score.caromsA) {
    return { error: "La tacada mayor no puede superar las carambolas." };
  }
  if (score.highRunB != null && score.highRunB > score.caromsB) {
    return { error: "La tacada mayor no puede superar las carambolas." };
  }

  const selectedWinner = String(formData.get("winnerId") ?? "");
  const selectedOk = selectedWinner === match.sideAId || selectedWinner === match.sideBId;

  const decision = decideWinner({
    caromsA: score.caromsA,
    caromsB: score.caromsB,
    innings: inningsForDecision(score.innings),
    distanceA: match.distanceA,
    distanceB: match.distanceB,
    equalInnings: match.tournament.equalInnings,
    maxInnings: match.tournament.maxInnings,
  });

  let winnerId: string;
  let closeReason: string;
  if (!("error" in decision)) {
    winnerId = decision.winner === "A" ? match.sideAId! : match.sideBId!;
    closeReason = decision.reason;
    if (selectedOk && selectedWinner !== winnerId) {
      winnerId = selectedWinner;
      closeReason = "resultado";
    }
  } else if (selectedOk) {
    winnerId = selectedWinner;
    closeReason = "resultado";
  } else {
    return { error: decision.error };
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: {
        caromsA: score.caromsA,
        caromsB: score.caromsB,
        innings: score.innings,
        highRunA: Number.isNaN(score.highRunA as number) ? null : score.highRunA,
        highRunB: Number.isNaN(score.highRunB as number) ? null : score.highRunB,
        status: "CLOSED",
        winnerId,
        closeReason,
        tableId: null,
        paused: false,
      },
    });
    const winner = winnerId === match.sideAId ? match.sideA : match.sideB;
    await placeWinnerInNext(
      tx,
      match.nextMatchId,
      match.nextSide,
      winnerId,
      winner?.distance ?? (winnerId === match.sideAId ? match.distanceA : match.distanceB),
    );
  });

  if (match.phase === "GROUP") await syncGroupQualification(match.tournamentId);

  if (match.phase === "PLAY_IN" && winnerId) {
    const { applyPlayInMatchResult } = await import("@/lib/repesca-result");
    await applyPlayInMatchResult(
      match.tournamentId,
      match.id,
      winnerId,
      match.sideAId,
      match.sideBId,
    );
  }

  if (match.phase === "KO") {
    await maybeAdvanceShuffleKnockoutRound(match.tournamentId);
  }

  revalidateTournament(match.tournamentId);
  return { ok: true };
}

export async function closeLiveMatch(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  const match = await ownedMatch(matchId, operator);
  if (!match) return { error: "Partido no encontrado." };

  const next = new FormData();
  next.set("matchId", match.id);
  next.set("caromsA", String(match.caromsA ?? 0));
  next.set("caromsB", String(match.caromsB ?? 0));
  next.set("innings", match.innings == null ? "" : String(match.innings));
  next.set("highRunA", match.highRunA == null ? "" : String(match.highRunA));
  next.set("highRunB", match.highRunB == null ? "" : String(match.highRunB));
  return closeMatch(next);
}

export async function walkoverMatch(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  const winnerId = String(formData.get("winnerId") ?? "");
  const match = await ownedMatch(matchId, operator);
  if (!match) return { error: "Partido no encontrado." };
  const closedWo = tournamentClosedMessage(match.tournament);
  if (closedWo) return { error: closedWo };
  if (isFinished(match.status)) return { error: "Ya está cerrado." };
  if (winnerId !== match.sideAId && winnerId !== match.sideBId) {
    return { error: "Elige quién avanza." };
  }

  const winner = winnerId === match.sideAId ? match.sideA : match.sideB;

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: {
        status: "WALKOVER",
        winnerId,
        closeReason: "walkover",
        caromsA: null,
        caromsB: null,
        innings: null,
        highRunA: null,
        highRunB: null,
        tableId: null,
        paused: false,
      },
    });
    await placeWinnerInNext(
      tx,
      match.nextMatchId,
      match.nextSide,
      winnerId,
      winner?.distance ?? (winnerId === match.sideAId ? match.distanceA : match.distanceB),
    );
  });

  if (match.phase === "GROUP") await syncGroupQualification(match.tournamentId);
  revalidateTournament(match.tournamentId);
  return { ok: true };
}

export async function reopenMatch(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  const match = await ownedMatch(matchId, operator);
  if (!match) return { error: "Partido no encontrado." };
  const closedReopen = tournamentClosedMessage(match.tournament);
  if (closedReopen) return { error: closedReopen };
  if (!isFinished(match.status)) return { error: "Ese partido no está cerrado." };
  if (match.closeReason === "bye") return { error: "Un pase directo no se reabre." };

  if (match.phase === "GROUP") {
    const realKo = await prisma.match.count({ where: realKoWhere(match.tournamentId) });
    if (realKo > 0) {
      return { error: "El cuadro de eliminación ya empezó. No reabras partidos de grupo." };
    }
  }

  if (match.nextMatchId) {
    const next = await prisma.match.findUnique({ where: { id: match.nextMatchId } });
    if (next && (next.status === "LIVE" || isFinished(next.status))) {
      return { error: "El ganador ya jugó el siguiente cruce. No se puede reabrir." };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: {
        status: "SCHEDULED",
        winnerId: null,
        closeReason: null,
        tableId: null,
      },
    });
    await clearWinnerFromNext(tx, match.nextMatchId, match.nextSide);
  });

  if (match.phase === "GROUP") {
    await dropKnockoutIfIdle(match.tournamentId);
    await syncGroupQualification(match.tournamentId);
  }

  revalidateTournament(match.tournamentId);
  return { ok: true };
}
