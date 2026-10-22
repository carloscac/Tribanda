"use server";

import { prisma } from "@/lib/prisma";
import { revalidateTournament } from "@/lib/revalidate";
import { isFinished } from "@/lib/scoring";
import { requireOrganizerOrAdmin } from "@/lib/session-user";
import { ownedMatchWhere } from "@/lib/tournament-access";
import { addCaromOnSide, passTurnOnMatch, seedVisitsIfNeeded, undoLastCarom } from "@/lib/visits";

async function playableMatch(matchId: string, operator: { id: string; role: import("@/lib/roles").UserRole }) {
  const match = await prisma.match.findFirst({
    where: ownedMatchWhere(matchId, operator.id, operator.role),
  });
  if (!match) return { error: "Partido no encontrado." as const };
  if (isFinished(match.status)) return { error: "El partido ya está cerrado." as const };
  if (match.paused) return { error: "El partido está en pausa." as const };
  if (!match.sideAId || !match.sideBId) return { error: "Faltan jugadores." as const };
  return { match };
}

export async function addCarom(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  const side = String(formData.get("side") ?? "");
  if (side !== "A" && side !== "B") return { error: "Elige un jugador." };

  const found = await playableMatch(matchId, operator);
  if ("error" in found) return { error: found.error };

  await prisma.$transaction(async (tx) => {
    await seedVisitsIfNeeded(tx, found.match);
    await addCaromOnSide(tx, found.match.id, side);
  });

  return { ok: true };
}

export async function undoCarom(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  const match = await prisma.match.findFirst({
    where: ownedMatchWhere(matchId, operator.id, operator.role),
  });
  if (!match) return { error: "Partido no encontrado." };
  if (isFinished(match.status)) return { error: "El partido ya está cerrado." };

  const result = await prisma.$transaction(async (tx) => undoLastCarom(tx, match.id));
  if (result && "error" in result) return result;

  return { ok: true };
}

export async function passTurn(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  const sideRaw = String(formData.get("side") ?? "");
  const side = sideRaw === "A" || sideRaw === "B" ? sideRaw : undefined;

  const found = await playableMatch(matchId, operator);
  if ("error" in found) return { error: found.error };

  await prisma.$transaction(async (tx) => {
    await seedVisitsIfNeeded(tx, found.match);
    await passTurnOnMatch(tx, found.match.id, side);
  });

  return { ok: true };
}

export async function foulAndTurn(formData: FormData) {
  return passTurn(formData);
}

export async function togglePause(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  const match = await prisma.match.findFirst({
    where: ownedMatchWhere(matchId, operator.id, operator.role),
  });
  if (!match) return { error: "Partido no encontrado." };
  if (isFinished(match.status)) return { error: "El partido ya está cerrado." };

  await prisma.match.update({
    where: { id: match.id },
    data: { paused: !match.paused },
  });
  return { ok: true };
}

export async function resetTable(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const matchId = String(formData.get("matchId") ?? "");
  const match = await prisma.match.findFirst({
    where: ownedMatchWhere(matchId, operator.id, operator.role),
  });
  if (!match) return { error: "Partido no encontrado." };
  if (isFinished(match.status)) return { error: "El partido ya está cerrado." };

  await prisma.$transaction(async (tx) => {
    await tx.matchVisit.deleteMany({ where: { matchId: match.id } });
    await tx.match.update({
      where: { id: match.id },
      data: {
        caromsA: 0,
        caromsB: 0,
        innings: 0,
        highRunA: null,
        highRunB: null,
        paused: false,
      },
    });
  });

  revalidateTournament(match.tournamentId);
  return { ok: true };
}
