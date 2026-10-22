"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session-user";
import { formatGoogleAd, parseAdProvider, parseGoogleAd, youtubeVideoId } from "@/lib/ad-embed";
import { adHref } from "@/lib/ad-href";
import { normalizeAdKind } from "@/lib/ads";
import { readImageFromForm, TOURNAMENT_IMAGE_MAX_BYTES, TOURNAMENT_IMAGE_TYPES } from "@/lib/tournament-image";

const MAX_SLIDES = 8;

async function readExtraSlides(formData: FormData) {
  const files = formData
    .getAll("slides")
    .filter((file): file is File => file instanceof File && file.size > 0);
  const slides: { mime: string; data: Buffer }[] = [];
  for (const file of files) {
    if (file.size > TOURNAMENT_IMAGE_MAX_BYTES) {
      return { error: "Una de las imágenes sigue siendo muy pesada. Prueba otra." as const };
    }
    if (!TOURNAMENT_IMAGE_TYPES.includes(file.type as (typeof TOURNAMENT_IMAGE_TYPES)[number])) {
      return { error: "Usa imágenes JPG, PNG, WebP o GIF." as const };
    }
    slides.push({ mime: file.type, data: Buffer.from(await file.arrayBuffer()) });
  }
  return { slides };
}

async function saveExtraSlides(adId: string, formData: FormData) {
  const incoming = await readExtraSlides(formData);
  if ("error" in incoming) return { error: incoming.error };
  const removeIds = formData
    .getAll("removeSlide")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const current = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM AdSlide WHERE adId = ${adId}
  `;
  const remaining = current.filter((row) => !removeIds.includes(row.id)).length;
  if (remaining + incoming.slides.length > MAX_SLIDES) {
    return { error: `El banner acepta hasta ${MAX_SLIDES} imágenes además de la principal.` };
  }
  for (const slideId of removeIds) {
    await prisma.$executeRaw`DELETE FROM AdSlide WHERE id = ${slideId} AND adId = ${adId}`;
  }
  let order = remaining;
  for (const slide of incoming.slides) {
    const slideId = `slide_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    order += 1;
    await prisma.$executeRaw`
      INSERT INTO AdSlide (id, adId, imageMime, imageData, sortOrder, createdAt)
      VALUES (${slideId}, ${adId}, ${slide.mime}, ${slide.data}, ${order}, CURRENT_TIMESTAMP(3))
    `;
  }
  return { ok: true as const };
}

export async function saveAd(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const kind = normalizeAdKind(String(formData.get("kind") ?? ""));
  const provider = parseAdProvider(String(formData.get("provider") ?? ""));
  const title = String(formData.get("title") ?? "").trim() || (provider === "GOOGLE" ? "Publicidad" : "");
  const body = String(formData.get("body") ?? "").trim() || null;
  const href = adHref(String(formData.get("href") ?? ""));
  const youtubeUrl = String(formData.get("youtubeUrl") ?? "").trim();
  const googleClient = String(formData.get("googleClient") ?? "").trim();
  const googleSlot = String(formData.get("googleSlot") ?? "").trim();
  const embed =
    provider === "YOUTUBE"
      ? youtubeUrl || null
      : provider === "GOOGLE"
        ? formatGoogleAd(googleClient, googleSlot)
        : null;
  const active = formData.get("active") === "on";
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const scope = String(formData.get("scope") ?? "");
  const requestedTournamentId = String(formData.get("tournamentId") ?? "").trim();
  const image = await readImageFromForm(formData, "image", "removeImage");

  if (title.length < 2) return { error: "Escribe el título del anuncio." };
  if (provider === "YOUTUBE" && !youtubeVideoId(embed)) {
    return { error: "Pega una URL de YouTube válida (watch, shorts o youtu.be)." };
  }
  if (provider === "GOOGLE" && !parseGoogleAd(embed)) {
    return { error: "Indica el ID de editor (ca-pub-…) y el ID del anuncio (slot) de Google AdSense." };
  }
  if (href === false) return { error: "Escribe la página del anunciante, por ejemplo https://www.anunciante.com." };
  if (image.kind === "error") return { error: image.error };
  const extraSlides = kind === "WIDE" && provider === "CUSTOM" ? await readExtraSlides(formData) : { slides: [] };
  if ("error" in extraSlides) return { error: extraSlides.error };
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 99) {
    return { error: "El orden debe ser un número entre 0 y 99." };
  }

  let tournamentId: string | null = null;
  if (scope === "tournament") {
    if (!requestedTournamentId) return { error: "Elige el torneo donde se verá el anuncio." };
    const tournament = await prisma.tournament.findUnique({
      where: { id: requestedTournamentId },
      select: { id: true },
    });
    if (!tournament) return { error: "Ese torneo ya no existe." };
    tournamentId = tournament.id;
  }

  let savedId = id;
  if (id) {
    await prisma.$executeRaw`
      UPDATE Ad
      SET kind = ${kind}, provider = ${provider}, title = ${title}, body = ${body}, href = ${href},
          embed = ${embed}, active = ${active}, sortOrder = ${sortOrder}, tournamentId = ${tournamentId},
          updatedAt = CURRENT_TIMESTAMP(3)
      WHERE id = ${id}
    `;
    if (image.kind === "set") {
      await prisma.$executeRaw`
        UPDATE Ad SET imageMime = ${image.mime}, imageData = ${image.data} WHERE id = ${id}
      `;
    }
    if (image.kind === "remove") {
      await prisma.$executeRaw`
        UPDATE Ad SET imageMime = NULL, imageData = NULL WHERE id = ${id}
      `;
    }
  } else {
    const createdId = `ad_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    await prisma.$executeRaw`
      INSERT INTO Ad (id, kind, provider, title, body, href, embed, active, sortOrder, tournamentId, createdAt, updatedAt)
      VALUES (${createdId}, ${kind}, ${provider}, ${title}, ${body}, ${href}, ${embed}, ${active}, ${sortOrder}, ${tournamentId}, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
    `;
    if (image.kind === "set") {
      await prisma.$executeRaw`
        UPDATE Ad SET imageMime = ${image.mime}, imageData = ${image.data} WHERE id = ${createdId}
      `;
    }
    savedId = createdId;
  }

  if (kind === "WIDE" && provider === "CUSTOM" && savedId) {
    const slides = await saveExtraSlides(savedId, formData);
    if ("error" in slides && slides.error) return { error: slides.error };
  }

  revalidatePath("/app/admin/publicidad");
  revalidatePath("/participante");
  revalidatePath("/torneos");
  return { ok: true };
}

export async function deleteAd(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Anuncio no encontrado." };
  await prisma.$executeRaw`DELETE FROM Ad WHERE id = ${id}`;
  revalidatePath("/app/admin/publicidad");
  revalidatePath("/participante");
  revalidatePath("/torneos");
  return { ok: true };
}
