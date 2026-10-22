import { revalidatePath } from "next/cache";

export function revalidateTournament(id: string) {
  revalidatePath("/app");
  revalidatePath("/app/torneos");
  revalidatePath(`/app/torneos/${id}`);
  revalidatePath(`/app/torneos/${id}/grupos`);
  revalidatePath(`/app/torneos/${id}/mando`);
  revalidatePath(`/app/torneos/${id}/cuadro`);
  revalidatePath(`/app/torneos/${id}/mesas`, "layout");
  revalidatePath("/t/[slug]", "layout");
}
