"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { isKnownColombiaCity } from "@/lib/colombia-cities";
import { isValidDocumentId, normalizeDocumentId } from "@/lib/document-id";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import { isParticipantLoginEmail } from "@/lib/participant-account";
import { linkParticipantInscriptions } from "@/lib/participant-link";
import { allocatePlayerCode } from "@/lib/player-code";
import { playingDistance } from "@/lib/player-handicap";
import { isValidMobilePhone, normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import {
  canPlayerSelfJoin,
  canSelfInscribe,
  categoryMismatchMessage,
  isStrongEnoughPassword,
  matchOrganizerCategory,
  tournamentRequiresPayment,
} from "@/lib/self-register";
import {
  dataProcessingAcceptanceWrite,
  requireDataProcessingAccepted,
} from "@/lib/data-processing";
import { getSessionUser } from "@/lib/session-user";
import { notifyInscriptionForPlayer } from "@/lib/notifications";
import { revalidateTournament } from "@/lib/revalidate";
import { readImageFromForm } from "@/lib/tournament-image";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function selfInscribeTournament(formData: FormData) {
  const tournamentId = String(formData.get("tournamentId") ?? "");
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      userId: true,
      name: true,
      slug: true,
      status: true,
      groupsFinalized: true,
      mix: true,
      singleCategoryId: true,
      entryFee: true,
    },
  });
  if (!tournament) return { error: "Torneo no encontrado." };
  if (!canSelfInscribe(tournament)) {
    return { error: "Este torneo ya no recibe inscripciones." };
  }

  const city = String(formData.get("city") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  if (!isKnownColombiaCity(city)) return { error: "Elige una ciudad de la lista." };
  if (!isValidEmail(emailRaw)) return { error: "El correo es obligatorio y debe ser válido." };
  const email = normalizeEmail(emailRaw);

  const photo = await readImageFromForm(formData, "photo");
  if (photo.kind === "error") return { error: photo.error };
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phoneFromForm = isValidMobilePhone(phoneRaw) ? normalizePhone(phoneRaw) : "";

  const session = await getSessionUser();
  let user =
    session?.role === "PARTICIPANT"
      ? await prisma.user.findUnique({ where: { id: session.id } })
      : null;

  if (session && session.role !== "PARTICIPANT") {
    return { error: "Entra como jugador para inscribirte, o usa una ventana sin sesión de organizador." };
  }

  if (!user) {
    const name = String(formData.get("name") ?? "").trim();
    const documentRaw = String(formData.get("documentId") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (name.length < 2) return { error: "Escribe tu nombre." };
    if (!phoneFromForm) {
      return { error: "El celular debe tener 10 dígitos y empezar por 3." };
    }
    if (!isValidDocumentId(documentRaw)) {
      return { error: "La cédula debe tener entre 5 y 15 dígitos." };
    }
    if (!isStrongEnoughPassword(password)) {
      return { error: "La contraseña debe tener al menos 6 caracteres." };
    }
    const consentError = requireDataProcessingAccepted(formData);
    if (consentError) return consentError;

    const documentId = normalizeDocumentId(documentRaw);
    const existing = await prisma.user.findFirst({ where: { documentId } });
    if (existing) {
      return { error: "Ya tienes cuenta. Entra con tu cédula y luego inscríbete." };
    }
    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) return { error: "Ese correo ya está en otra cuenta." };

    user = await prisma.user.create({
      data: {
        name,
        email,
        documentId,
        passwordHash: await bcrypt.hash(password, 10),
        role: "PARTICIPANT",
        ...dataProcessingAcceptanceWrite(),
      },
    });
    if (phoneFromForm) {
      await prisma.$executeRaw`UPDATE User SET phone = ${phoneFromForm} WHERE id = ${user.id}`;
    }
  } else {
    const emailTaken = await prisma.user.findFirst({
      where: { email, NOT: { id: user.id } },
    });
    if (emailTaken) return { error: "Ese correo ya está en otra cuenta." };
    if (!user.dataProcessingAcceptedAt) {
      const consentError = requireDataProcessingAccepted(formData);
      if (consentError) return consentError;
    }
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        email,
        ...(user.dataProcessingAcceptedAt ? {} : dataProcessingAcceptanceWrite()),
      },
    });
  }

  if (!user.documentId) return { error: "Tu cuenta no tiene cédula. Pide ayuda al organizador." };

  const categories = await prisma.category.findMany({
    where: { userId: tournament.userId, active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, distance: true },
  });

  let player = await prisma.player.findFirst({
    where: { documentId: user.documentId },
    include: { category: { select: { id: true, name: true, distance: true } } },
  });
  const phone = phoneFromForm || player?.phone || null;

  if (player) {
    const already = await prisma.inscription.findFirst({
      where: { tournamentId, playerId: player.id },
      select: { paid: true },
    });
    if (already) {
      return {
        error: already.paid
          ? "Ya estás inscrito en este torneo."
          : "Ya tienes una solicitud. Paga la inscripción para quedar inscrito.",
      };
    }
  }

  const single =
    tournament.mix === "SINGLE" && tournament.singleCategoryId
      ? (categories.find((row) => row.id === tournament.singleCategoryId) ??
        (await prisma.category.findUnique({
          where: { id: tournament.singleCategoryId },
          select: { id: true, name: true, distance: true },
        })))
      : null;
  const playerHint = player
    ? {
        categoryId: player.categoryId,
        handicap: player.handicap,
        categoryName: player.category?.name ?? null,
        categoryDistance: player.category?.distance ?? null,
      }
    : null;
  const join = canPlayerSelfJoin(tournament, single, playerHint);
  if (!join.allowed) {
    return { error: categoryMismatchMessage(single) };
  }

  let categoryId: string | null = null;
  let distance = 0;
  if (single) {
    categoryId = single.id;
    distance = single.distance;
  } else {
    const fromPlayer = matchOrganizerCategory(categories, playerHint);
    if (fromPlayer) {
      categoryId = fromPlayer.id;
      distance = fromPlayer.distance;
    } else {
      const chosen = String(formData.get("categoryId") ?? "");
      const category = categories.find((row) => row.id === chosen) ?? null;
      if (!category) return { error: "Elige tu categoría." };
      categoryId = category.id;
      distance = category.distance;
    }
  }
  if (player?.handicap != null) {
    distance = playingDistance(player.handicap, distance);
  }
  if (!Number.isInteger(distance) || distance < 1) {
    return { error: "No se pudo asignar la distancia. Elige una categoría." };
  }

  if (player) {
    player = await prisma.player.update({
      where: { id: player.id },
      data: {
        email,
        phone,
        name: user.name,
        ...(categoryId && !player.categoryId ? { categoryId } : {}),
        ...(player.handicap == null ? { handicap: distance } : {}),
      },
      include: { category: { select: { id: true, name: true, distance: true } } },
    });
  } else {
    player = await prisma.player.create({
      data: {
        userId: tournament.userId,
        code: await allocatePlayerCode(),
        name: user.name,
        documentId: user.documentId,
        email,
        phone,
        categoryId,
        handicap: distance,
      },
      include: { category: { select: { id: true, name: true, distance: true } } },
    });
  }

  await prisma.$executeRaw`UPDATE Player SET city = ${city} WHERE id = ${player.id}`;
  if (photo.kind === "set") {
    const photoUrl = `/api/jugadores/${player.id}/foto?v=${Date.now()}`;
    await prisma.$executeRaw`
      UPDATE Player
        SET photoMime = ${photo.mime}, photoData = ${photo.data}, photoUrl = ${photoUrl}, updatedAt = CURRENT_TIMESTAMP(3)
      WHERE id = ${player.id}
    `;
  }

  await prisma.inscription.create({
    data: {
      tournamentId,
      playerId: player.id,
      participantUserId: user.id,
      categoryId,
      distance,
      paid: !tournamentRequiresPayment(tournament.entryFee),
    },
  });

  await linkParticipantInscriptions(user.id, {
    documentId: user.documentId,
    email: isParticipantLoginEmail(email) ? null : email,
  });

  if (tournament.status === "DRAFT") {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: "REGISTRATION" },
    });
  }

  revalidateTournament(tournamentId);
  revalidatePath("/participante");
  revalidatePath("/participante/torneos");
  revalidatePath("/torneos");
  revalidatePath(`/t/${tournament.slug}`, "layout");

  void notifyInscriptionForPlayer({
    tournamentId,
    tournamentName: tournament.name,
    playerId: player.id,
    paid: !tournamentRequiresPayment(tournament.entryFee),
    entryFee: tournament.entryFee,
  }).catch((err) => console.error("notifyInscriptionForPlayer", err));

  if (!session) {
    try {
      await signIn("credentials", {
        login: user.documentId,
        password: String(formData.get("password") ?? ""),
        redirectTo: `/t/${tournament.slug}/inscribirse?ok=1`,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect(`/entrar?rol=participante&next=${encodeURIComponent(`/t/${tournament.slug}`)}`);
      }
      throw error;
    }
  }

  redirect(`/t/${tournament.slug}/inscribirse?ok=1`);
}
