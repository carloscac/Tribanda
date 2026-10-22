"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseCOP } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { revalidateTournament } from "@/lib/revalidate";
import { requireOrganizer, requireOrganizerOrAdmin } from "@/lib/session-user";
import { findTournamentForAccess } from "@/lib/tournament-access";
import { requireTournament } from "@/lib/session";
import { finishBlockReason } from "@/lib/tournament-finish";
import { parseKnockoutDrawMode, parseKnockoutFillMode } from "@/lib/knockout-entry";
import { parseKnockoutFirstRoundPairing } from "@/lib/bracket-predraw";
import { parsePrizeShareMode } from "@/lib/prize-pool";
import {
  readParticipantScreensFromForm,
  serializeParticipantScreens,
} from "@/lib/participant-screens";
import { uniqueSlug } from "@/lib/slug";
import { snapshotTournamentRecords } from "@/lib/player-history";
import { notifyTournamentCreated } from "@/lib/notifications";
import { readTournamentImage } from "@/lib/tournament-image";
import {
  readPaymentFromForm,
  saveTournamentPayment,
  validateTournamentPayment,
} from "@/lib/tournament-payment";
import { saveTournamentHidden } from "@/lib/tournament-visibility";
import { parseGroupTiebreak } from "@/lib/group-standing";
import { writeGroupTiebreak } from "@/lib/group-tiebreak-db";

function readTournamentFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const venue = String(formData.get("venue") ?? "").trim() || null;
  const dateRaw = String(formData.get("date") ?? "");
  const mix = String(formData.get("mix") ?? "MIXED") === "SINGLE" ? "SINGLE" : "MIXED";
  const singleCategoryId = String(formData.get("singleCategoryId") ?? "") || null;
  const equalInnings = formData.get("equalInnings") === "on";
  const requireInnings = formData.get("requireInnings") === "on";
  const maxInningsRaw = String(formData.get("maxInnings") ?? "").trim();
  const tableCount = Number(formData.get("tableCount") ?? 4);
  const groupSize = Number(formData.get("groupSize") ?? 4);
  const plannedRaw = String(formData.get("plannedCapacity") ?? "").trim();
  const qualifyRaw = String(formData.get("qualifyPerGroup") ?? "").trim();
  const groupTiebreakRaw = String(formData.get("groupTiebreak") ?? "").trim();
  const prizeChampion = formData.get("prizeChampion") === "on";
  const prizeHighRun = formData.get("prizeHighRun") === "on";
  const prizeBestAverage = formData.get("prizeBestAverage") === "on";
  const entryFeeRaw = String(formData.get("entryFee") ?? "").trim();
  const entryFee = entryFeeRaw === "" ? null : parseCOP(entryFeeRaw);
  const repescaFeeRaw = String(formData.get("repescaFee") ?? "").trim();
  const repescaFee = repescaFeeRaw === "" ? null : parseCOP(repescaFeeRaw);
  const knockoutLayoutRaw = String(formData.get("knockoutLayout") ?? "COLUMNS");
  const knockoutLayout = knockoutLayoutRaw === "SPLIT" ? "SPLIT" : "COLUMNS";
  const knockoutFillMode = parseKnockoutFillMode(String(formData.get("knockoutFillMode") ?? "AUTO"));
  const knockoutDrawMode = parseKnockoutDrawMode(String(formData.get("knockoutDrawMode") ?? "FIXED"));
  const knockoutPreDraw = formData.get("knockoutPreDraw") === "on";
  const knockoutFirstRoundPairing = parseKnockoutFirstRoundPairing(
    String(formData.get("knockoutFirstRoundPairing") ?? "CROSS_GROUP_SEED"),
  );
  const participantScreens = serializeParticipantScreens(readParticipantScreensFromForm(formData));
  const prizeShareMode = parsePrizeShareMode(String(formData.get("prizeShareMode") ?? "FIXED"));
  const prizePoolPercentRaw = String(formData.get("prizePoolPercent") ?? "").trim();
  const prizePoolPercentParsed =
    prizePoolPercentRaw === "" ? null : Number(prizePoolPercentRaw);
  const prizePoolPercent =
    prizePoolPercentParsed != null && Number.isInteger(prizePoolPercentParsed)
      ? prizePoolPercentParsed
      : null;

  let date: Date | null = null;
  if (dateRaw) {
    const parsed = new Date(`${dateRaw}T12:00:00`);
    date = Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const plannedCapacityParsed =
    plannedRaw === "" ? null : Number(plannedRaw);
  const plannedCapacity =
    plannedCapacityParsed != null && Number.isInteger(plannedCapacityParsed)
      ? plannedCapacityParsed
      : null;

  return {
    name,
    venue,
    date,
    mix,
    singleCategoryId: mix === "SINGLE" ? singleCategoryId : null,
    equalInnings,
    requireInnings,
    maxInnings: maxInningsRaw ? Number(maxInningsRaw) : null,
    tableCount,
    groupSize,
    plannedCapacity,
    qualifyPerGroup: qualifyRaw
      ? Number(qualifyRaw)
      : groupSize === 3
        ? 1
        : 2,
    groupTiebreak: parseGroupTiebreak(groupTiebreakRaw || undefined),
    prizeChampion,
    prizeHighRun,
    prizeBestAverage,
    entryFee,
    repescaFee,
    knockoutLayout,
    knockoutFillMode,
    knockoutDrawMode,
    knockoutPreDraw,
    knockoutFirstRoundPairing,
    participantScreens,
    prizePoolPercent,
    prizeShareMode,
  };
}

function readPrizePlaces(formData: FormData) {
  const prizeCount = Number(formData.get("prizeCount") ?? 0);
  const prizeShareMode = parsePrizeShareMode(String(formData.get("prizeShareMode") ?? "FIXED"));
  const amounts = formData.getAll("prizeAmount").map(String);
  const shares = formData.getAll("prizeSharePercent").map(String);
  const places = Array.from({ length: Number.isInteger(prizeCount) ? prizeCount : 0 }, (_, i) => {
    if (prizeShareMode === "PERCENT") {
      const sharePercent = Number(String(shares[i] ?? "").trim());
      return { place: i + 1, amount: 0, sharePercent };
    }
    const amount = parseCOP(amounts[i] ?? "");
    return { place: i + 1, amount: amount ?? Number.NaN, sharePercent: null as number | null };
  });
  return { prizeCount, places, prizeShareMode };
}

const MAX_PRIZE_PLACES = 32;

function validatePrizes(
  prizeCount: number,
  places: { place: number; amount: number; sharePercent: number | null }[],
  prizeShareMode: ReturnType<typeof parsePrizeShareMode>,
) {
  if (!Number.isInteger(prizeCount) || prizeCount < 0 || prizeCount > MAX_PRIZE_PLACES) {
    return `Indica entre 0 y ${MAX_PRIZE_PLACES} jugadores con premio.`;
  }
  if (prizeCount === 0) return null;
  if (places.length !== prizeCount) return "Completa el premio de cada puesto.";
  if (prizeShareMode === "PERCENT") {
    let sum = 0;
    for (const row of places) {
      if (
        row.sharePercent == null ||
        !Number.isInteger(row.sharePercent) ||
        row.sharePercent < 1 ||
        row.sharePercent > 100
      ) {
        return `El porcentaje del ${row.place}º puesto debe ser entre 1 y 100.`;
      }
      sum += row.sharePercent;
    }
    if (sum !== 100) {
      return `Los porcentajes de premio deben sumar 100 % (ahora suman ${sum} %).`;
    }
    return null;
  }
  for (const row of places) {
    if (!Number.isInteger(row.amount) || row.amount < 1 || row.amount > 50_000_000) {
      return `El premio del ${row.place}º no es válido.`;
    }
  }
  return null;
}

function validate(fields: ReturnType<typeof readTournamentFields>) {
  if (fields.name.length < 3) return "El nombre del torneo es muy corto.";
  if (
    !Number.isInteger(fields.groupSize) ||
    fields.groupSize < 3 ||
    fields.groupSize > 8
  ) {
    return "Jugadores por grupo: entre 3 y 8.";
  }
  if (fields.tableCount < 1 || fields.tableCount > 32) return "Mesas: entre 1 y 32.";
  if (fields.qualifyPerGroup < 1 || fields.qualifyPerGroup >= fields.groupSize) {
    return "Los clasificados deben ser menos que el tamaño del grupo.";
  }
  if (
    fields.plannedCapacity != null &&
    (!Number.isInteger(fields.plannedCapacity) ||
      fields.plannedCapacity < fields.groupSize ||
      fields.plannedCapacity > 256)
  ) {
    return "Cupo previsto: entre el tamaño de grupo y 256, o déjalo vacío.";
  }
  if (fields.maxInnings != null && (fields.maxInnings < 5 || fields.maxInnings > 200)) {
    return "Límite de entradas no válido.";
  }
  if (fields.mix === "SINGLE" && !fields.singleCategoryId) {
    return "Elige la categoría del torneo.";
  }
  if (fields.entryFee != null && (!Number.isInteger(fields.entryFee) || fields.entryFee < 0 || fields.entryFee > 20_000_000)) {
    return "El valor de inscripción no es válido.";
  }
  if (
    fields.repescaFee != null &&
    (!Number.isInteger(fields.repescaFee) || fields.repescaFee < 0 || fields.repescaFee > 20_000_000)
  ) {
    return "El cobro de repesca no es válido.";
  }
  if (
    fields.prizePoolPercent != null &&
    (!Number.isInteger(fields.prizePoolPercent) ||
      fields.prizePoolPercent < 1 ||
      fields.prizePoolPercent > 100)
  ) {
    return "El % destinado a premios debe estar entre 1 y 100.";
  }
  return null;
}

export async function createTournament(formData: FormData) {
  const user = await requireOrganizer();
  const userId = user.id;
  const fields = readTournamentFields(formData);
  const { prizeCount, places, prizeShareMode } = readPrizePlaces(formData);
  const image = await readTournamentImage(formData);
  if (image.kind === "error") return { error: image.error };
  const payment = readPaymentFromForm(formData);
  const error =
    validate(fields) ??
    validatePrizes(prizeCount, places, prizeShareMode) ??
    validateTournamentPayment(fields.entryFee, payment);
  if (error) return { error };

  const { groupTiebreak, ...persist } = fields;
  const tournament = await prisma.tournament.create({
    data: {
      userId,
      ...persist,
      ...(image.kind === "set" ? { imageData: image.data, imageMime: image.mime } : {}),
      slug: uniqueSlug(fields.name),
      status: "DRAFT",
      tables: {
        create: Array.from({ length: fields.tableCount }, (_, i) => ({
          number: i + 1,
        })),
      },
      prizes: {
        create: places.map((row) => ({
          place: row.place,
          amount: row.amount,
          sharePercent: row.sharePercent,
        })),
      },
    },
  });

  try {
    await writeGroupTiebreak(tournament.id, groupTiebreak);
    await saveTournamentPayment(tournament.id, payment);
    await saveTournamentHidden(tournament.id, formData.get("listed") !== "on");
    await notifyTournamentCreated({
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      tournamentSlug: tournament.slug,
      venue: tournament.venue,
      organizerName: user.name,
    });
  } catch (err) {
    console.error("notifyTournamentCreated", err);
  }

  revalidatePath("/app");
  revalidatePath("/app/torneos");
  revalidatePath("/torneos");
  revalidatePath("/participante/torneos");
  redirect(`/app/torneos/${tournament.id}`);
}

export async function updateTournament(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const id = String(formData.get("id") ?? "");
  const fields = readTournamentFields(formData);
  const { prizeCount, places, prizeShareMode } = readPrizePlaces(formData);
  const image = await readTournamentImage(formData);
  if (image.kind === "error") return { error: image.error };
  const payment = readPaymentFromForm(formData);
  const error =
    validate(fields) ??
    validatePrizes(prizeCount, places, prizeShareMode) ??
    validateTournamentPayment(fields.entryFee, payment);
  if (error) return { error };

  const existing = await findTournamentForAccess(id, operator.id, operator.role);
  if (!existing) return { error: "Torneo no encontrado." };

  const { groupTiebreak, ...persist } = fields;
  try {
    await prisma.tournament.update({
      where: { id },
      data: {
        ...persist,
        ...(image.kind === "set" ? { imageData: image.data, imageMime: image.mime } : {}),
        ...(image.kind === "remove" ? { imageData: null, imageMime: null } : {}),
      },
    });
    await prisma.tournamentPrize.deleteMany({ where: { tournamentId: id } });
    if (places.length > 0) {
      await prisma.tournamentPrize.createMany({
        data: places.map((row) => ({
          tournamentId: id,
          place: row.place,
          amount: row.amount,
          sharePercent: row.sharePercent,
        })),
      });
    }

    if (existing.tableCount !== fields.tableCount) {
      await prisma.table.deleteMany({ where: { tournamentId: id } });
      await prisma.table.createMany({
        data: Array.from({ length: fields.tableCount }, (_, i) => ({
          tournamentId: id,
          number: i + 1,
        })),
      });
    }
  } catch (err) {
    console.error("updateTournament", err);
    return {
      error:
        "No se pudieron guardar los cambios. Revisa la fecha y el cupo previsto; si acabas de actualizar la app, reinicia el servidor (npm run dev).",
    };
  }

  try {
    await writeGroupTiebreak(id, groupTiebreak);
  } catch (err) {
    console.error("writeGroupTiebreak", err);
    return { error: "El torneo se actualizó, pero no se pudo guardar el criterio de clasificación. Vuelve a intentarlo." };
  }
  await saveTournamentPayment(id, payment);
  try {
    await saveTournamentHidden(id, formData.get("listed") !== "on");
  } catch (err) {
    console.error("saveTournamentHidden", err);
  }

  revalidatePath("/app");
  revalidatePath("/torneos");
  revalidatePath("/participante/torneos");
  revalidatePath("/app/torneos");
  revalidatePath("/participante");
  revalidatePath(`/app/torneos/${id}`);
  revalidatePath(`/app/torneos/${id}/editar`);
  revalidatePath(`/t/${existing.slug}`, "layout");
  return { ok: true };
}

export async function closeTournament(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const id = String(formData.get("tournamentId") ?? "");
  const tournament = await requireTournament(id, operator.id, operator.role);
  if (!tournament) return { error: "Torneo no encontrado." };

  if (tournament.status === "CLOSED") {
    return { error: "Este torneo ya está finalizado." };
  }

  const pendingMatches = await prisma.match.count({
    where: { tournamentId: id, status: { in: ["SCHEDULED", "LIVE"] } },
  });
  const block = finishBlockReason(tournament.status, pendingMatches);
  if (block) return { error: block };

  await prisma.tournament.update({
    where: { id },
    data: { status: "CLOSED" },
  });
  try {
    await snapshotTournamentRecords(id);
  } catch (err) {
    console.error("snapshotTournamentRecords", err);
  }

  revalidateTournament(id);
  revalidatePath("/app/jugadores");
  revalidatePath(`/app/torneos/${id}/editar`);
  revalidatePath(`/t/${tournament.slug}`);
  return { ok: true };
}
