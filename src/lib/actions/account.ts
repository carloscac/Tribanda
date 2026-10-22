"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/session-user";

export async function changeOwnPassword(formData: FormData) {
  const user = await requireSessionUser();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword) return { error: "Escribe tu contraseña actual." };
  if (newPassword.length < 6) {
    return { error: "La nueva contraseña debe tener al menos 6 caracteres." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "La confirmación no coincide con la nueva contraseña." };
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!row) return { error: "Usuario no encontrado." };

  const ok = await bcrypt.compare(currentPassword, row.passwordHash);
  if (!ok) return { error: "La contraseña actual no es correcta." };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });

  revalidatePath("/app/cuenta");
  revalidatePath("/participante/perfil");
  return { ok: true };
}
