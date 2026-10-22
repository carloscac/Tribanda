"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireParticipant } from "@/lib/session-user";

export async function markNotificationRead(formData: FormData) {
  const user = await requireParticipant();
  const id = String(formData.get("id") ?? "");

  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { readAt: new Date() },
  });

  revalidatePath("/participante");
  return { ok: true };
}

export async function markAllNotificationsRead() {
  const user = await requireParticipant();

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/participante");
  return { ok: true };
}
