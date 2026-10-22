"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { revalidateTournament } from "@/lib/revalidate";
import { requireOrganizerOrAdmin } from "@/lib/session-user";
import { isTournamentOwnerOrAdmin } from "@/lib/tournament-access";
import { requireTournamentForAction } from "@/lib/session";
import {
  attachParticipantAccess,
  readDocumentIdFromForm,
} from "@/lib/player-participant";
import { isValidMobilePhone, normalizePhone } from "@/lib/phone";
import { allocatePlayerCode } from "@/lib/player-code";
import { requireDataProcessingAttested } from "@/lib/data-processing";
import { notifyInscriptionForPlayer } from "@/lib/notifications";
import { rememberPlayerHandicap } from "@/lib/player-handicap";

export async function inscribeExistingPlayer(formData: FormData) {
  const tournamentId = String(formData.get("tournamentId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const distance = Number(formData.get("distance"));
  const paid = formData.get("paid") === "on";

  const ctx = await requireTournamentForAction(tournamentId);
  if (!ctx) return { error: "Torneo no encontrado." };
  const { tournament, ownerId } = ctx;

  const player = await prisma.player.findFirst({ where: { id: playerId } });
  if (!player) return { error: "Jugador no encontrado." };

  if (!Number.isInteger(distance) || distance < 1) return { error: "Distancia no válida." };

  const fromForm = readDocumentIdFromForm(formData);
  if (fromForm === false) return { error: "La cédula debe tener entre 5 y 15 dígitos." };

  let documentId = player.documentId;
  if (!documentId) {
    if (!fromForm) {
      return {
        error:
          "Este jugador no tiene cédula. Indícala para que pueda entrar en Soy participante (usuario y contraseña = cédula).",
      };
    }
    documentId = fromForm;
  } else if (fromForm && fromForm !== documentId) {
    return { error: "La cédula no coincide con la del jugador en la agenda." };
  }

  try {
    await prisma.inscription.create({
      data: { tournamentId, playerId, categoryId, distance, paid },
    });
  } catch {
    return { error: "Ese jugador ya está inscrito." };
  }

  await rememberPlayerHandicap({
    playerId,
    handicap: distance,
    reason: `Torneo ${tournament.name}`,
    changedByName: ctx.user.name,
  });

  const access = await attachParticipantAccess({
    userId: ownerId,
    playerId: player.id,
    name: player.name,
    documentId,
    email: player.email,
  });
  if ("error" in access) return access;

  if (tournament.status === "DRAFT") {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: "REGISTRATION" },
    });
  }

  revalidateTournament(tournamentId);
  revalidatePath("/app/jugadores");
  void notifyInscriptionForPlayer({
    tournamentId,
    tournamentName: tournament.name,
    playerId: player.id,
    paid,
    entryFee: tournament.entryFee,
  }).catch((err) => console.error("notifyInscriptionForPlayer", err));
  return { ok: true };
}

export async function createAndInscribe(formData: FormData) {
  const tournamentId = String(formData.get("tournamentId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const distance = Number(formData.get("distance"));
  const paid = formData.get("paid") === "on";

  const ctx = await requireTournamentForAction(tournamentId);
  if (!ctx) return { error: "Torneo no encontrado." };
  const { tournament, ownerId } = ctx;

  if (name.length < 2) return { error: "Escribe el nombre." };
  const attestError = requireDataProcessingAttested(formData);
  if (attestError) return attestError;
  if (!Number.isInteger(distance) || distance < 1) return { error: "Distancia no válida." };

  const documentId = readDocumentIdFromForm(formData);
  if (documentId === false) return { error: "La cédula debe tener entre 5 y 15 dígitos." };
  if (!documentId) {
    return {
      error:
        "La cédula es obligatoria. El jugador entra con ese número en usuario y contraseña (Soy participante).",
    };
  }

  const phoneRaw = String(formData.get("phone") ?? "").trim();
  if (!isValidMobilePhone(phoneRaw)) {
    return { error: "El celular es obligatorio (10 dígitos, inicia en 3). Lo usaremos para WhatsApp." };
  }
  const phone = normalizePhone(phoneRaw);

  const existing = await prisma.player.findFirst({ where: { documentId } });
  let playerId = existing?.id ?? "";

  if (existing) {
    const already = await prisma.inscription.findFirst({
      where: { tournamentId, playerId: existing.id },
    });
    if (already) {
      return {
        error: `Ese deportista ya está inscrito (${existing.code ?? "sin código"}).`,
      };
    }
    if (!existing.phone) {
      await prisma.player.update({
        where: { id: existing.id },
        data: { phone },
      });
    }
  } else {
    const created = await prisma.player.create({
      data: {
        userId: ownerId,
        code: await allocatePlayerCode(),
        name,
        categoryId,
        documentId,
        phone,
        handicap: distance,
      },
    });
    const access = await attachParticipantAccess({
      userId: ownerId,
      playerId: created.id,
      name,
      documentId,
    });
    if ("error" in access) {
      await prisma.player.delete({ where: { id: created.id } });
      return access;
    }
    playerId = created.id;
  }

  if (existing) {
    const access = await attachParticipantAccess({
      userId: ownerId,
      playerId: existing.id,
      name: existing.name,
      documentId,
    });
    if ("error" in access) return access;
  }

  await prisma.inscription.create({
    data: { tournamentId, playerId, categoryId, distance, paid },
  });

  if (existing) {
    await rememberPlayerHandicap({
      playerId,
      handicap: distance,
      reason: `Torneo ${tournament.name}`,
      changedByName: ctx.user.name,
    });
  }

  if (tournament.status === "DRAFT") {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: "REGISTRATION" },
    });
  }

  revalidateTournament(tournamentId);
  revalidatePath("/app/jugadores");
  void notifyInscriptionForPlayer({
    tournamentId,
    tournamentName: tournament.name,
    playerId,
    paid,
    entryFee: tournament.entryFee,
  }).catch((err) => console.error("notifyInscriptionForPlayer", err));
  return { ok: true };
}

export async function updateInscription(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const id = String(formData.get("id") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const distance = Number(formData.get("distance"));
  const paid = formData.get("paid") === "on";

  const row = await prisma.inscription.findFirst({
    where: { id },
    include: { tournament: true },
  });
  if (!row || !isTournamentOwnerOrAdmin(row.tournament.userId, operator)) {
    return { error: "Inscripción no encontrada." };
  }
  if (!Number.isInteger(distance) || distance < 1) return { error: "Distancia no válida." };

  await prisma.inscription.update({
    where: { id },
    data: {
      categoryId,
      distance,
      ...(formData.has("paid") ? { paid } : {}),
    },
  });

  if (distance !== row.distance) {
    await prisma.match.updateMany({
      where: { sideAId: id, status: "SCHEDULED" },
      data: { distanceA: distance },
    });
    await prisma.match.updateMany({
      where: { sideBId: id, status: "SCHEDULED" },
      data: { distanceB: distance },
    });
  }

  await rememberPlayerHandicap({
    playerId: row.playerId,
    handicap: distance,
    categoryId,
    reason: `Torneo ${row.tournament.name}`,
    changedByName: operator.name,
  });

  revalidateTournament(row.tournamentId);
  revalidatePath("/app/jugadores");
  revalidatePath(`/app/jugadores/${row.playerId}`);
  return { ok: true };
}

export async function removeInscription(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const id = String(formData.get("id") ?? "");

  const row = await prisma.inscription.findFirst({
    where: { id },
    include: { tournament: true },
  });
  if (!row || !isTournamentOwnerOrAdmin(row.tournament.userId, operator)) {
    return { error: "Inscripción no encontrada." };
  }

  const played = await prisma.match.count({
    where: {
      tournamentId: row.tournamentId,
      status: { in: ["CLOSED", "WALKOVER"] },
      OR: [{ sideAId: id }, { sideBId: id }],
    },
  });
  if (played > 0) return { error: "Ese jugador ya tiene partidos cerrados." };

  const groups = await prisma.group.count({ where: { tournamentId: row.tournamentId } });
  if (groups > 0) {
    return { error: "Con grupos armados no se borra al inscrito. Usa Sustituir." };
  }

  await prisma.inscription.delete({ where: { id } });
  revalidateTournament(row.tournamentId);
  return { ok: true };
}

export async function togglePaid(id: string) {
  const operator = await requireOrganizerOrAdmin();
  const row = await prisma.inscription.findFirst({
    where: { id },
    include: { tournament: true },
  });
  if (!row || !isTournamentOwnerOrAdmin(row.tournament.userId, operator)) {
    return { error: "Inscripción no encontrada." };
  }

  await prisma.inscription.update({
    where: { id },
    data: { paid: !row.paid },
  });
  revalidateTournament(row.tournamentId);
  return { ok: true };
}

export async function toggleCheckIn(id: string) {
  const operator = await requireOrganizerOrAdmin();
  const row = await prisma.inscription.findFirst({
    where: { id },
    include: { tournament: true },
  });
  if (!row || !isTournamentOwnerOrAdmin(row.tournament.userId, operator)) {
    return { error: "Inscripción no encontrada." };
  }

  await prisma.inscription.update({
    where: { id },
    data: { checkedIn: !row.checkedIn },
  });
  revalidateTournament(row.tournamentId);
  return { ok: true };
}

export async function replaceInscriptionPlayer(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const inscriptionId = String(formData.get("inscriptionId") ?? "");
  const source = String(formData.get("source") ?? "new");
  const playerId = String(formData.get("playerId") ?? "");
  const benchInscriptionId = String(formData.get("benchInscriptionId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const distance = Number(formData.get("distance"));
  const paid = formData.get("paid") === "on";

  const row = await prisma.inscription.findFirst({
    where: { id: inscriptionId },
    include: { tournament: true, groupMembers: true },
  });
  if (!row || !isTournamentOwnerOrAdmin(row.tournament.userId, operator)) {
    return { error: "Inscripción no encontrada." };
  }
  const ownerId = row.tournament.userId;
  if (row.groupMembers.length === 0) {
    return { error: "Ese jugador no está en un grupo." };
  }
  if (!Number.isInteger(distance) || distance < 1) return { error: "Distancia no válida." };

  if (categoryId) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId: ownerId } });
    if (!category) return { error: "Categoría no válida." };
  }

  const blocking = await prisma.match.count({
    where: {
      tournamentId: row.tournamentId,
      status: { in: ["LIVE", "CLOSED", "WALKOVER"] },
      OR: [{ sideAId: inscriptionId }, { sideBId: inscriptionId }],
    },
  });
  if (blocking > 0) {
    return { error: "Ese jugador ya tiene un partido en mesa o cerrado. No se puede sustituir." };
  }

  let nextPlayerId = "";
  let deleteBenchId: string | null = null;

  if (source === "new") {
    if (name.length < 2) return { error: "Escribe el nombre de quien entra." };
    const documentId = readDocumentIdFromForm(formData);
    if (documentId === false) return { error: "La cédula debe tener entre 5 y 15 dígitos." };
    if (!documentId) {
      return { error: "Indica la cédula de quien entra para que pueda usar la app." };
    }
    const dup = await prisma.player.findFirst({ where: { documentId } });
    if (dup) {
      const already = await prisma.inscription.findFirst({
        where: { tournamentId: row.tournamentId, playerId: dup.id },
      });
      if (already) {
        return { error: `Ese deportista ya está inscrito (${dup.code ?? "sin código"}).` };
      }
      const access = await attachParticipantAccess({
        userId: ownerId,
        playerId: dup.id,
        name: dup.name,
        documentId,
      });
      if ("error" in access) return access;
      nextPlayerId = dup.id;
    } else {
      const created = await prisma.player.create({
        data: {
          userId: ownerId,
          code: await allocatePlayerCode(),
          name,
          categoryId,
          documentId,
        },
      });
      const access = await attachParticipantAccess({
        userId: ownerId,
        playerId: created.id,
        name,
        documentId,
      });
      if ("error" in access) {
        await prisma.player.delete({ where: { id: created.id } });
        return access;
      }
      nextPlayerId = created.id;
    }
  } else if (source === "bench") {
    const bench = await prisma.inscription.findFirst({
      where: { id: benchInscriptionId, tournamentId: row.tournamentId },
      include: { groupMembers: true },
    });
    if (!bench) return { error: "Ese suplente no está en este torneo." };
    if (bench.id === row.id) return { error: "Elige a otra persona." };
    if (bench.groupMembers.length > 0) return { error: "Ese jugador ya está en un grupo." };
    nextPlayerId = bench.playerId;
    deleteBenchId = bench.id;
  } else {
    const player = await prisma.player.findFirst({ where: { id: playerId } });
    if (!player) return { error: "Jugador no encontrado." };
    if (!player.documentId) {
      return {
        error:
          "Ese jugador no tiene cédula. Agrégala en Jugadores o usa Persona nueva con cédula.",
      };
    }
    const already = await prisma.inscription.findFirst({
      where: { tournamentId: row.tournamentId, playerId: player.id },
    });
    if (already) {
      return { error: "Ese jugador ya está inscrito. Si no quedó en un grupo, elígelo como suplente." };
    }
    nextPlayerId = player.id;
  }

  await prisma.$transaction(async (tx) => {
    if (deleteBenchId) {
      await tx.inscription.delete({ where: { id: deleteBenchId } });
    }
    await tx.inscription.update({
      where: { id: row.id },
      data: {
        playerId: nextPlayerId,
        categoryId,
        distance,
        paid,
        checkedIn: true,
      },
    });
    await tx.match.updateMany({
      where: { sideAId: row.id, status: "SCHEDULED" },
      data: { distanceA: distance },
    });
    await tx.match.updateMany({
      where: { sideBId: row.id, status: "SCHEDULED" },
      data: { distanceB: distance },
    });
  });

  await rememberPlayerHandicap({
    playerId: nextPlayerId,
    handicap: distance,
    categoryId,
    reason: `Torneo ${row.tournament.name}`,
    changedByName: operator.name,
  });

  const entered = await prisma.player.findFirst({
    where: { id: nextPlayerId, userId: ownerId },
  });
  if (entered?.documentId) {
    const access = await attachParticipantAccess({
      userId: ownerId,
      playerId: entered.id,
      name: entered.name,
      documentId: entered.documentId,
      email: entered.email,
    });
    if ("error" in access) return access;
  }

  revalidateTournament(row.tournamentId);
  revalidatePath("/app/jugadores");
  return { ok: true };
}

export async function assignInscribedPlayerDocument(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const inscriptionId = String(formData.get("inscriptionId") ?? "");
  const documentId = readDocumentIdFromForm(formData);
  if (documentId === false) return { error: "La cédula debe tener entre 5 y 15 dígitos." };
  if (!documentId) return { error: "Indica la cédula." };

  const row = await prisma.inscription.findFirst({
    where: { id: inscriptionId },
    include: {
      tournament: { omit: { imageData: true } },
      player: { omit: { photoData: true } },
    },
  });
  if (!row || !isTournamentOwnerOrAdmin(row.tournament.userId, operator)) {
    return { error: "Inscripción no encontrada." };
  }
  const ownerId = row.tournament.userId;

  if (row.player.documentId && row.player.documentId !== documentId) {
    return { error: "Este jugador ya tiene otra cédula en la agenda." };
  }

  const access = await attachParticipantAccess({
    userId: ownerId,
    playerId: row.playerId,
    name: row.player.name,
    documentId,
    email: row.player.email,
  });
  if ("error" in access) return access;

  revalidateTournament(row.tournamentId);
  revalidatePath("/app/jugadores");
  return { ok: true };
}

export async function checkInAll(tournamentId: string) {
  const ctx = await requireTournamentForAction(tournamentId);
  if (!ctx) return { error: "Torneo no encontrado." };

  await prisma.inscription.updateMany({
    where: { tournamentId },
    data: { checkedIn: true },
  });
  revalidateTournament(tournamentId);
  return { ok: true };
}
