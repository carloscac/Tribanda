export const TOURNAMENT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const TOURNAMENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export type TournamentImageChange =
  | { kind: "keep" }
  | { kind: "remove" }
  | { kind: "set"; data: Buffer; mime: string }
  | { kind: "error"; error: string };

export function tournamentImageSrc(
  tournamentId: string,
  updatedAt?: Date | string | number | null,
) {
  const version =
    updatedAt instanceof Date
      ? updatedAt.getTime()
      : updatedAt
        ? new Date(updatedAt).getTime()
        : 0;
  return `/api/torneos/${tournamentId}/imagen${version ? `?v=${version}` : ""}`;
}

export async function readImageFromForm(
  formData: FormData,
  fileField = "image",
  removeField = "removeImage",
): Promise<TournamentImageChange> {
  if (String(formData.get(removeField) ?? "") === "on") {
    return { kind: "remove" };
  }

  const file = formData.get(fileField);
  if (!(file instanceof File) || file.size === 0) {
    return { kind: "keep" };
  }
  if (file.size > TOURNAMENT_IMAGE_MAX_BYTES) {
    return { kind: "error", error: "La imagen sigue siendo muy pesada. Prueba otra foto." };
  }
  const mime = file.type;
  if (!TOURNAMENT_IMAGE_TYPES.includes(mime as (typeof TOURNAMENT_IMAGE_TYPES)[number])) {
    return { kind: "error", error: "Usa una imagen JPG, PNG, WebP o GIF." };
  }
  const data = Buffer.from(await file.arrayBuffer());
  return { kind: "set", data, mime };
}

export async function readTournamentImage(formData: FormData): Promise<TournamentImageChange> {
  return readImageFromForm(formData);
}
