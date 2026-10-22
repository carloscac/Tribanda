"use server";

import { revalidatePath } from "next/cache";
import { isValidMobilePhone, normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import {
  dataProcessingAcceptanceWrite,
  requireDataProcessingAccepted,
} from "@/lib/data-processing";
import { requireParticipant } from "@/lib/session-user";
import { readImageFromForm } from "@/lib/tournament-image";

export async function updateParticipantProfile(formData: FormData) {
  const user = await requireParticipant();
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { dataProcessingAcceptedAt: true },
  });
  if (!account?.dataProcessingAcceptedAt) {
    const consentError = requireDataProcessingAccepted(formData);
    if (consentError) return consentError;
  }
  const name = String(formData.get("name") ?? "").trim();
  const alias = String(formData.get("alias") ?? "").trim() || null;
  const club = String(formData.get("club") ?? "").trim() || null;
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const photo = await readImageFromForm(formData, "photo");

  if (name.length < 2) return { error: "Escribe tu nombre." };
  if (photo.kind === "error") return { error: photo.error };

  let phone: string | null = null;
  if (phoneRaw) {
    if (!isValidMobilePhone(phoneRaw)) {
      return { error: "El celular debe tener 10 dígitos y empezar por 3." };
    }
    phone = normalizePhone(phoneRaw);
  }

  const player = await prisma.player.findFirst({
    where: user.documentId ? { documentId: user.documentId } : { inscriptions: { some: { participantUserId: user.id } } },
    select: { id: true },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      ...(account?.dataProcessingAcceptedAt ? {} : dataProcessingAcceptanceWrite()),
    },
  });

  if (player) {
    await prisma.player.update({
      where: { id: player.id },
      data: { name, alias, club, phone },
    });
    if (photo.kind === "set") {
      const photoUrl = `/api/jugadores/${player.id}/foto?v=${Date.now()}`;
      await prisma.$executeRaw`
        UPDATE Player
        SET photoMime = ${photo.mime}, photoData = ${photo.data}, photoUrl = ${photoUrl}, updatedAt = CURRENT_TIMESTAMP(3)
        WHERE id = ${player.id}
      `;
    }
  }

  revalidatePath("/participante");
  revalidatePath("/participante/perfil");
  revalidatePath("/app/jugadores");
  revalidatePath("/app");
  revalidatePath("/t/[slug]", "layout");
  return { ok: true };
}
