"use server";

import { revalidatePath } from "next/cache";
import { findTournamentForAccess } from "@/lib/tournament-access";
import { requireOrganizerOrAdmin } from "@/lib/session-user";
import { saveTournamentHidden } from "@/lib/tournament-visibility";

export async function toggleTournamentHidden(formData: FormData) {
  const operator = await requireOrganizerOrAdmin();
  const id = String(formData.get("id") ?? "");
  const hidden = String(formData.get("hidden") ?? "") === "1";

  const tournament = await findTournamentForAccess(id, operator.id, operator.role);
  if (!tournament) return { error: "Torneo no encontrado." };

  await saveTournamentHidden(id, hidden);
  revalidatePath("/app/torneos");
  revalidatePath("/torneos");
  revalidatePath("/participante/torneos");
  revalidatePath(`/t/${tournament.slug}`, "layout");
  return { ok: true };
}
