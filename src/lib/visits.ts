import type { Prisma } from "@prisma/client";
import { inningForNewVisit } from "@/lib/dashboard";

type Tx = Prisma.TransactionClient;

export async function syncMatchTotals(tx: Tx, matchId: string) {
  const visits = await tx.matchVisit.findMany({ where: { matchId } });
  const a = visits.filter((v) => v.side === "A");
  const b = visits.filter((v) => v.side === "B");
  const caromsA = a.reduce((sum, v) => sum + v.caroms, 0);
  const caromsB = b.reduce((sum, v) => sum + v.caroms, 0);
  const highRunA = a.reduce((max, v) => Math.max(max, v.caroms), 0);
  const highRunB = b.reduce((max, v) => Math.max(max, v.caroms), 0);
  const innings = visits.reduce((max, v) => Math.max(max, v.inning), 0);

  await tx.match.update({
    where: { id: matchId },
    data: {
      caromsA,
      caromsB,
      innings,
      highRunA: highRunA || null,
      highRunB: highRunB || null,
    },
  });
}

export async function seedVisitsIfNeeded(
  tx: Tx,
  match: { id: string; caromsA: number | null; caromsB: number | null; innings: number | null },
) {
  const count = await tx.matchVisit.count({ where: { matchId: match.id } });
  if (count > 0) return;

  const a = match.caromsA ?? 0;
  const b = match.caromsB ?? 0;
  if (a === 0 && b === 0) return;

  const inning = Math.max(match.innings ?? 1, 1);
  const now = new Date();
  if (a > 0) {
    await tx.matchVisit.create({
      data: { matchId: match.id, inning, side: "A", caroms: a, endedAt: now },
    });
  }
  if (b > 0) {
    await tx.matchVisit.create({
      data: { matchId: match.id, inning, side: "B", caroms: b, endedAt: now },
    });
  }
}

export async function addCaromOnSide(tx: Tx, matchId: string, side: "A" | "B") {
  const visits = await tx.matchVisit.findMany({
    where: { matchId },
    orderBy: { createdAt: "asc" },
  });
  const open = [...visits].reverse().find((v) => !v.endedAt);
  const last = visits[visits.length - 1];

  if (!open) {
    await tx.matchVisit.create({
      data: {
        matchId,
        side,
        inning: inningForNewVisit(last, side),
        caroms: 1,
      },
    });
  } else if (open.side !== side) {
    await tx.matchVisit.update({
      where: { id: open.id },
      data: { endedAt: new Date() },
    });
    await tx.matchVisit.create({
      data: {
        matchId,
        side,
        inning: inningForNewVisit(open, side),
        caroms: 1,
      },
    });
  } else {
    await tx.matchVisit.update({
      where: { id: open.id },
      data: { caroms: open.caroms + 1 },
    });
  }

  await syncMatchTotals(tx, matchId);
}

export async function undoLastCarom(tx: Tx, matchId: string) {
  const visits = await tx.matchVisit.findMany({
    where: { matchId },
    orderBy: { createdAt: "asc" },
  });
  if (visits.length === 0) return { error: "No hay carambolas para deshacer." };

  const open = [...visits].reverse().find((v) => !v.endedAt);
  const target = open ?? visits[visits.length - 1];

  if (!open && target.endedAt) {
    await tx.matchVisit.update({
      where: { id: target.id },
      data: { endedAt: null },
    });
  }

  const current = await tx.matchVisit.findUnique({ where: { id: target.id } });
  if (!current) return { error: "No hay carambolas para deshacer." };

  if (current.caroms > 0) {
    await tx.matchVisit.update({
      where: { id: current.id },
      data: { caroms: current.caroms - 1 },
    });
  } else {
    await tx.matchVisit.delete({ where: { id: current.id } });
    const previous = visits.filter((v) => v.id !== current.id).at(-1);
    if (previous?.endedAt) {
      await tx.matchVisit.update({
        where: { id: previous.id },
        data: { endedAt: null },
      });
    }
  }

  await syncMatchTotals(tx, matchId);
  return { ok: true as const };
}

export async function registerFoul(tx: Tx, matchId: string) {
  return passTurnOnMatch(tx, matchId);
}

export async function passTurnOnMatch(tx: Tx, matchId: string, side?: "A" | "B") {
  const visits = await tx.matchVisit.findMany({
    where: { matchId },
    orderBy: { createdAt: "asc" },
  });
  const open = [...visits].reverse().find((v) => !v.endedAt);
  const last = visits[visits.length - 1];
  const finishing: "A" | "B" = open?.side === "A" || open?.side === "B"
    ? open.side
    : side ?? (last?.side === "B" ? "A" : last?.side === "A" ? "B" : "A");

  const now = new Date();
  let lastForInning: { side: string; inning: number };

  if (open) {
    await tx.matchVisit.update({
      where: { id: open.id },
      data: { endedAt: now },
    });
    lastForInning = { side: open.side, inning: open.inning };
  } else {
    const inning = inningForNewVisit(last, finishing);
    await tx.matchVisit.create({
      data: {
        matchId,
        side: finishing,
        inning,
        caroms: 0,
        endedAt: now,
      },
    });
    lastForInning = { side: finishing, inning };
  }

  const nextSide = lastForInning.side === "A" ? "B" : "A";
  await tx.matchVisit.create({
    data: {
      matchId,
      side: nextSide,
      inning: inningForNewVisit(lastForInning, nextSide),
      caroms: 0,
    },
  });
  await syncMatchTotals(tx, matchId);
  return { ok: true as const };
}
