"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return session.user.id;
}

export async function createCategory(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  const distance = Number(formData.get("distance"));

  if (!name) return { error: "Nombre requerido." };
  if (!Number.isInteger(distance) || distance < 1 || distance > 80) {
    return { error: "La distancia debe ser un número entre 1 y 80." };
  }

  const last = await prisma.category.findFirst({
    where: { userId },
    orderBy: { sortOrder: "desc" },
  });

  try {
    await prisma.category.create({
      data: {
        userId,
        name,
        distance,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });
  } catch {
    return { error: "Ya tienes una categoría con ese nombre." };
  }

  revalidatePath("/app/categorias");
  return { ok: true };
}

export async function updateCategory(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const distance = Number(formData.get("distance"));

  if (!id || !name) return { error: "Datos incompletos." };
  if (!Number.isInteger(distance) || distance < 1 || distance > 80) {
    return { error: "La distancia debe ser un número entre 1 y 80." };
  }

  const category = await prisma.category.findFirst({ where: { id, userId } });
  if (!category) return { error: "Categoría no encontrada." };

  try {
    await prisma.category.update({
      where: { id },
      data: { name, distance },
    });
  } catch {
    return { error: "Ya tienes una categoría con ese nombre." };
  }

  revalidatePath("/app/categorias");
  return { ok: true };
}

export async function toggleCategory(id: string) {
  const userId = await requireUserId();
  const category = await prisma.category.findFirst({ where: { id, userId } });
  if (!category) return { error: "Categoría no encontrada." };

  await prisma.category.update({
    where: { id },
    data: { active: !category.active },
  });

  revalidatePath("/app/categorias");
  return { ok: true };
}
