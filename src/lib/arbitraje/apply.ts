import { prisma } from "@/lib/prisma";
import { clearWinnerFromNext, placeWinnerInNext, realKoWhere } from "@/lib/ko";
import { isFinished } from "@/lib/scoring";
import { syncGroupQualification, dropKnockoutIfIdle } from "@/lib/qualification";
import { maybeAdvanceShuffleKnockoutRound } from "@/lib/knockout-shuffle-round";
import { applyPlayInMatchResult } from "@/lib/repesca-result";
import { dispatch, openLocalMatch } from "@/lib/arbitraje/domain/commands";
import { projectMatch } from "@/lib/arbitraje/domain/fold";
import { revisionOf } from "@/lib/arbitraje/domain/revision";
import type { MatchBaseline, RefereeEvent } from "@/lib/arbitraje/domain/types";
import type { RefereePrincipal } from "@/lib/arbitraje/auth";
import { baselineFromMatch, matchInclude } from "@/lib/arbitraje/baseline";

const EVENT_TYPES = new Set([
  "CAROM",
  "BREAK",
  "INNING",
  "UNDO",
  "UNDO_SERVER",
  "PAUSE",
  "RESUME",
  "TIMEOUT_START",
  "TIMEOUT_END",
  "FINISH",
]);

export class RefereeCommandError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public serverRevision = "",
  ) {
    super(message);
  }
}

function accessWhere(user: RefereePrincipal, matchId: string) {
  if (user.role === "ADMIN") return { id: matchId };
  return { id: matchId, tournament: { userId: user.id } };
}

async function koRounds(tournamentId: string) {
  const ko = await prisma.match.aggregate({
    where: { tournamentId, phase: "KO" },
    _max: { round: true },
  });
  return ko._max.round ?? 1;
}

function parseEvents(raw: unknown, matchId: string): RefereeEvent[] {
  if (!Array.isArray(raw)) throw new RefereeCommandError(422, "VALIDATION", "El cuerpo no trae eventos.");
  if (raw.length > 200) throw new RefereeCommandError(422, "VALIDATION", "Demasiados eventos en un envío.");
  return raw.map((item) => {
    if (!item || typeof item !== "object") {
      throw new RefereeCommandError(422, "VALIDATION", "Hay un evento inválido.");
    }
    const event = item as RefereeEvent;
    if (typeof event.id !== "string" || event.id.length < 8 || event.id.length > 80) {
      throw new RefereeCommandError(422, "VALIDATION", "Hay un evento sin identificador válido.");
    }
    if (event.matchId !== matchId) {
      throw new RefereeCommandError(422, "VALIDATION", "El evento pertenece a otro partido.");
    }
    if (!EVENT_TYPES.has(event.type) || Number.isNaN(Date.parse(event.createdAt))) {
      throw new RefereeCommandError(422, "VALIDATION", "Hay un evento con tipo o fecha inválidos.");
    }
    return event;
  });
}

async function headRevision(baseline: MatchBaseline, events: RefereeEvent[]) {
  const projected = projectMatch(baseline, events);
  return revisionOf({
    status: projected.status,
    paused: projected.paused,
    caromsA: projected.caromsA,
    caromsB: projected.caromsB,
    innings: projected.innings,
    highRunA: projected.highRunA,
    highRunB: projected.highRunB,
    closeReason: projected.closeReason,
    winnerSide: projected.winnerSide,
    visits: projected.visits,
  });
}

export async function readSnapshot(user: RefereePrincipal, matchId: string) {
  const match = await prisma.match.findFirst({
    where: accessWhere(user, matchId),
    include: matchInclude,
  });
  if (!match || !match.sideAId || !match.sideBId) {
    throw new RefereeCommandError(404, "NOT_FOUND", "Partido no encontrado.");
  }
  const rounds = await koRounds(match.tournamentId);
  const pulledAt = new Date().toISOString();
  const sync = await prisma.refereeSync.findUnique({ where: { matchId: match.id } });
  if (!sync) {
    const baseline = baselineFromMatch(match, pulledAt, rounds);
    const revision = await headRevision(baseline, []);
    baseline.revision = revision;
    return { match: baseline, events: [] as RefereeEvent[], revision, diverged: false };
  }
  const baseline = JSON.parse(sync.baseline) as ReturnType<typeof baselineFromMatch>;
  const rows = await prisma.refereeEvent.findMany({
    where: { matchId: match.id, epoch: sync.epoch },
    orderBy: { sequence: "asc" },
  });
  const events = rows.map((row) => JSON.parse(row.payload) as RefereeEvent);
  const revision = await headRevision(baseline, events);
  const projected = projectMatch(baseline, events);
  const diverged =
    (match.caromsA ?? 0) !== projected.caromsA ||
    (match.caromsB ?? 0) !== projected.caromsB ||
    (match.innings ?? 0) !== projected.innings ||
    (match.highRunA ?? 0) !== projected.highRunA ||
    (match.highRunB ?? 0) !== projected.highRunB ||
    match.status !== projected.status ||
    match.paused !== projected.paused;
  return { match: baseline, events, revision, diverged };
}

export async function listAssigned(user: RefereePrincipal) {
  const matches = await prisma.match.findMany({
    where: {
      tournament: user.role === "ADMIN" ? { status: { not: "CLOSED" } } : { userId: user.id, status: { not: "CLOSED" } },
      sideAId: { not: null },
      sideBId: { not: null },
      status: { in: ["SCHEDULED", "LIVE", "CLOSED"] },
      NOT: { closeReason: "bye" },
    },
    include: {
      tournament: { select: { name: true } },
      table: { select: { number: true } },
      group: { select: { name: true } },
      sideA: { select: { player: { select: { name: true } } } },
      sideB: { select: { player: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return {
    matches: matches.map((match) => ({
      id: match.id,
      tournamentId: match.tournamentId,
      tournamentName: match.tournament.name,
      tableNumber: match.table?.number ?? null,
      status: match.status,
      paused: match.paused,
      playerA: match.sideA?.player.name ?? "",
      playerB: match.sideB?.player.name ?? "",
      groupName: match.group?.name ?? null,
      phaseLabel: match.phase === "GROUP" ? match.group?.name ?? "Grupos" : match.phase === "PLAY_IN" ? "Repesca" : `Ronda ${match.round}`,
      caromsA: match.caromsA ?? 0,
      caromsB: match.caromsB ?? 0,
      pending: 0,
    })),
  };
}

export async function adoptDatabase(user: RefereePrincipal, matchId: string) {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findFirst({ where: accessWhere(user, matchId), include: matchInclude });
    if (!match || !match.sideAId || !match.sideBId) {
      throw new RefereeCommandError(404, "NOT_FOUND", "Partido no encontrado.");
    }
    await tx.match.update({ where: { id: match.id }, data: { paused: match.paused } });
    const rounds = await koRounds(match.tournamentId);
    const baseline = baselineFromMatch(match, new Date().toISOString(), rounds);
    const revision = await headRevision(baseline, []);
    baseline.revision = revision;
    const existing = await tx.refereeSync.findUnique({ where: { matchId: match.id } });
    if (!existing) return { match: baseline, events: [] as RefereeEvent[], revision, diverged: false };
    await tx.refereeSync.update({
      where: { matchId: match.id },
      data: {
        baseline: JSON.stringify(baseline),
        tableId: match.tableId,
        epoch: { increment: 1 },
      },
    });
    return { match: baseline, events: [] as RefereeEvent[], revision, diverged: false };
  });
}

export async function applyEvents(
  user: RefereePrincipal,
  matchId: string,
  expectedRevision: string,
  rawEvents: unknown,
  force: boolean,
) {
  const incoming = parseEvents(rawEvents, matchId);
  const outcome = await prisma.$transaction(async (tx) => {
    const match = await tx.match.findFirst({ where: accessWhere(user, matchId), include: matchInclude });
    if (!match || !match.sideAId || !match.sideBId) {
      throw new RefereeCommandError(404, "NOT_FOUND", "Partido no encontrado.");
    }
    if (match.tournament.status === "CLOSED") {
      throw new RefereeCommandError(422, "VALIDATION", "El torneo ya está finalizado.");
    }
    await tx.match.update({ where: { id: match.id }, data: { paused: match.paused } });
    const locked = await tx.match.findFirst({ where: { id: match.id }, include: matchInclude });
    if (!locked) throw new RefereeCommandError(404, "NOT_FOUND", "Partido no encontrado.");

    const rounds = await koRounds(locked.tournamentId);
    let sync = await tx.refereeSync.findUnique({ where: { matchId: locked.id } });
    const baseline = sync
      ? (JSON.parse(sync.baseline) as ReturnType<typeof baselineFromMatch>)
      : baselineFromMatch(locked, new Date().toISOString(), rounds);
    if (!sync) {
      const revision = await headRevision(baseline, []);
      baseline.revision = revision;
      if (revision !== expectedRevision) {
        throw new RefereeCommandError(409, "CONFLICT", "El partido cambió en el servidor. No se sobrescribió.", revision);
      }
      sync = await tx.refereeSync.create({
        data: {
          matchId: locked.id,
          baseline: JSON.stringify(baseline),
          tableId: locked.tableId,
          epoch: 1,
        },
      });
    }

    const rows = await tx.refereeEvent.findMany({
      where: { matchId: locked.id, epoch: sync.epoch },
      orderBy: { sequence: "asc" },
    });
    const stored = rows.map((row) => JSON.parse(row.payload) as RefereeEvent);
    const known = new Set(stored.map((event) => event.id));
    const fresh = incoming.filter((event) => !known.has(event.id));
    const currentRevision = await headRevision(baseline, stored);
    const projectedNow = projectMatch(baseline, stored);
    const diverged =
      (locked.caromsA ?? 0) !== projectedNow.caromsA ||
      (locked.caromsB ?? 0) !== projectedNow.caromsB ||
      (locked.innings ?? 0) !== projectedNow.innings ||
      (locked.highRunA ?? 0) !== projectedNow.highRunA ||
      (locked.highRunB ?? 0) !== projectedNow.highRunB ||
      locked.status !== projectedNow.status ||
      locked.paused !== projectedNow.paused;

    if (fresh.length === 0 && !diverged) {
      return {
        body: bodyOf(currentRevision, incoming.map((event) => event.id), projectedNow),
        follow: null,
      };
    }
    if (currentRevision !== expectedRevision) {
      throw new RefereeCommandError(409, "CONFLICT", "El partido cambió en el servidor. No se sobrescribió.", currentRevision);
    }
    if (diverged && !force) {
      throw new RefereeCommandError(
        409,
        "CONFLICT",
        "El marcador fue modificado fuera de la tablet. No se sobrescribió.",
        currentRevision,
      );
    }

    let working = openLocalMatch(baseline);
    working.events = stored.map((event) => ({ ...event, sync: "synced" as const, attempts: 0 }));
    const accepted: RefereeEvent[] = [];
    for (const event of fresh) {
      const result = dispatch(working, toCommand(event), {
        user: { id: user.id, name: user.name, role: user.role, active: user.active },
        deviceId: user.deviceId,
        now: event.createdAt,
        ids: () => event.id,
      });
      if (!result.ok) throw new RefereeCommandError(422, "VALIDATION", result.error);
      if (result.event.type !== event.type || (event.targetEventId ?? null) !== (result.event.targetEventId ?? null)) {
        throw new RefereeCommandError(409, "CONFLICT", "El evento no coincide con el historial del servidor.", currentRevision);
      }
      accepted.push(result.event);
      working = result.match;
    }

    const before = projectedNow;
    const after = projectMatch(baseline, [...stored, ...accepted]);
    const reopening = isFinished(before.status) && !isFinished(after.status);
    if (reopening) {
      if (locked.closeReason === "bye") {
        throw new RefereeCommandError(422, "VALIDATION", "Un pase directo no se reabre.");
      }
      if (locked.phase === "GROUP") {
        const realKo = await tx.match.count({ where: realKoWhere(locked.tournamentId) });
        if (realKo > 0) {
          throw new RefereeCommandError(422, "VALIDATION", "El cuadro de eliminación ya empezó. No reabras partidos de grupo.");
        }
      }
      if (locked.nextMatchId) {
        const next = await tx.match.findUnique({ where: { id: locked.nextMatchId } });
        if (next && (next.status === "LIVE" || isFinished(next.status))) {
          throw new RefereeCommandError(422, "VALIDATION", "El ganador ya jugó el siguiente cruce. No se puede reabrir.");
        }
      }
      if (sync.tableId) {
        const occupied = await tx.match.findFirst({
          where: { tableId: sync.tableId, status: "LIVE", id: { not: locked.id } },
        });
        if (occupied) {
          throw new RefereeCommandError(409, "CONFLICT", "La mesa ya tiene otro partido. No se reabrió este.", currentRevision);
        }
      }
    }

    const maxSeq = rows.reduce((max, row) => Math.max(max, row.sequence), 0);
    for (const [index, event] of accepted.entries()) {
      await tx.refereeEvent.create({
        data: {
          id: event.id,
          matchId: locked.id,
          userId: user.id,
          deviceId: user.deviceId,
          epoch: sync.epoch,
          sequence: maxSeq + index + 1,
          type: event.type,
          payload: JSON.stringify(event),
          clientTime: new Date(event.createdAt),
        },
      });
    }

    await tx.matchVisit.deleteMany({ where: { matchId: locked.id } });
    if (after.visits.length > 0) {
      const stamp = Date.now();
      await tx.matchVisit.createMany({
        data: after.visits.map((visit, index) => ({
          id: visit.id,
          matchId: locked.id,
          side: visit.side,
          inning: visit.inning,
          caroms: visit.caroms,
          endedAt: visit.endedAt ? new Date(visit.endedAt) : null,
          createdAt: new Date(stamp + index),
        })),
      });
    }

    const closing = !isFinished(before.status) && after.status === "CLOSED";
    const winnerId = after.winnerSide === "A" ? locked.sideAId : after.winnerSide === "B" ? locked.sideBId : null;
    await tx.match.update({
      where: { id: locked.id },
      data: {
        caromsA: after.caromsA,
        caromsB: after.caromsB,
        innings: after.innings,
        highRunA: after.highRunA || null,
        highRunB: after.highRunB || null,
        paused: after.status === "CLOSED" ? false : after.paused,
        status: after.status,
        liveStartedAt: locked.liveStartedAt ?? (after.status === "LIVE" ? new Date() : null),
        winnerId: after.status === "CLOSED" ? winnerId : null,
        closeReason: after.status === "CLOSED" ? after.closeReason : null,
        ...(closing ? { tableId: null } : reopening ? { tableId: sync.tableId } : {}),
      },
    });

    if (closing && winnerId) {
      const distance = after.winnerSide === "A" ? locked.distanceA : locked.distanceB;
      await placeWinnerInNext(tx, locked.nextMatchId, locked.nextSide, winnerId, distance);
    }
    if (reopening) await clearWinnerFromNext(tx, locked.nextMatchId, locked.nextSide);

    const revision = await headRevision(baseline, [...stored, ...accepted]);
    return {
      body: bodyOf(revision, incoming.map((event) => event.id), after),
      follow: closing
        ? { kind: "closed" as const, match: locked, winnerId }
        : reopening
          ? { kind: "reopened" as const, tournamentId: locked.tournamentId, phase: locked.phase }
          : null,
    };
  });

  if (outcome.follow?.kind === "closed" && outcome.follow.winnerId) {
    const match = outcome.follow.match;
    if (match.phase === "GROUP") await syncGroupQualification(match.tournamentId);
    if (match.phase === "PLAY_IN") {
      await applyPlayInMatchResult(match.tournamentId, match.id, outcome.follow.winnerId, match.sideAId, match.sideBId);
    }
    if (match.phase === "KO") await maybeAdvanceShuffleKnockoutRound(match.tournamentId);
  }
  if (outcome.follow?.kind === "reopened" && outcome.follow.phase === "GROUP") {
    await dropKnockoutIfIdle(outcome.follow.tournamentId);
    await syncGroupQualification(outcome.follow.tournamentId);
  }
  return outcome.body;
}

function toCommand(event: RefereeEvent) {
  if (event.type === "CAROM") return { type: "CAROM" as const, matchId: event.matchId, side: event.side ?? "A" as const };
  if (event.type === "INNING") return { type: "INNING" as const, matchId: event.matchId, side: event.side };
  if (event.type === "PAUSE") return { type: "PAUSE" as const, matchId: event.matchId };
  if (event.type === "RESUME") return { type: "RESUME" as const, matchId: event.matchId };
  if (event.type === "TIMEOUT_START") return { type: "TIMEOUT_START" as const, matchId: event.matchId };
  if (event.type === "TIMEOUT_END") return { type: "TIMEOUT_END" as const, matchId: event.matchId };
  if (event.type === "FINISH") return { type: "FINISH" as const, matchId: event.matchId, winnerSide: event.winnerSide };
  return { type: "UNDO" as const, matchId: event.matchId };
}

function bodyOf(
  revision: string,
  acceptedIds: string[],
  projected: { caromsA: number; caromsB: number; innings: number; highRunA: number; highRunB: number; status: string; paused: boolean },
) {
  return {
    revision,
    acceptedIds,
    caromsA: projected.caromsA,
    caromsB: projected.caromsB,
    innings: projected.innings,
    highRunA: projected.highRunA,
    highRunB: projected.highRunB,
    status: projected.status,
    paused: projected.paused,
  };
}
