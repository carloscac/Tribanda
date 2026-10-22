"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { DEFAULT_CATEGORIES } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session-user";

export async function createOrganizerAccount(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (name.length < 2) return { error: "Escribe el nombre del organizador." };
  if (!email.includes("@")) return { error: "Email no válido." };
  if (password.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres." };

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { error: "Ya existe una cuenta con ese email." };

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "ORGANIZER",
      categories: {
        create: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      },
    },
  });

  revalidatePath("/app/admin");
  return { ok: true };
}

export async function updateOrganizerAccount(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!id) return { error: "Usuario no indicado." };
  if (name.length < 2) return { error: "Escribe el nombre del organizador." };
  if (!email.includes("@")) return { error: "Email no válido." };

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { error: "Usuario no encontrado." };
  if (user.role !== "ORGANIZER") {
    return { error: "Solo puedes editar cuentas de organizador." };
  }

  const taken = await prisma.user.findFirst({
    where: { email, NOT: { id } },
    select: { id: true },
  });
  if (taken) return { error: "Ya existe otra cuenta con ese email." };

  await prisma.user.update({
    where: { id },
    data: { name, email },
  });

  revalidatePath("/app/admin");
  return { ok: true };
}

export async function resetUserPassword(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!id) return { error: "Usuario no indicado." };
  if (password.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres." };

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { error: "Usuario no encontrado." };
  if (user.role === "ADMIN") {
    return { error: "Los administradores cambian su contraseña en Mi cuenta." };
  }
  if (user.role === "PARTICIPANT") {
    return { error: "Los participantes entran con la cédula; actualízala en Jugadores." };
  }

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });

  revalidatePath("/app/admin");
  return { ok: true };
}

export async function toggleUserActive(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { error: "Usuario no encontrado." };
  if (user.role === "ADMIN") return { error: "No puedes desactivar un administrador." };

  await prisma.user.update({ where: { id }, data: { active: !user.active } });
  revalidatePath("/app/admin");
  return { ok: true };
}
