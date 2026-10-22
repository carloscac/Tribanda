import { parseAdProvider, type AdProvider } from "@/lib/ad-embed";
import { prisma } from "@/lib/prisma";

export const AD_KINDS = ["INTERSTITIAL", "BANNER", "WIDE"] as const;
export type AdKind = (typeof AD_KINDS)[number];

export function normalizeAdKind(kind: string): AdKind {
  if (kind === "BANNER" || kind === "WIDE") return kind;
  return "INTERSTITIAL";
}

export type PublicAd = {
  id: string;
  kind: AdKind;
  provider: AdProvider;
  title: string;
  body: string | null;
  href: string | null;
  embed: string | null;
  hasImage: boolean;
  slides: { id: string; createdAt: string }[];
  updatedAt: string;
};

export function adImageSrc(id: string, updatedAt?: string | Date | number | null) {
  const version =
    updatedAt instanceof Date
      ? updatedAt.getTime()
      : updatedAt
        ? new Date(updatedAt).getTime()
        : 0;
  return `/api/anuncios/${id}/imagen${version ? `?v=${version}` : ""}`;
}

export function adSlideSrc(adId: string, slideId: string, createdAt?: string | Date | number | null) {
  const version =
    createdAt instanceof Date
      ? createdAt.getTime()
      : createdAt
        ? new Date(createdAt).getTime()
        : 0;
  return `/api/anuncios/${adId}/diapositiva/${slideId}${version ? `?v=${version}` : ""}`;
}

type AdRow = {
  id: string;
  kind: string;
  provider?: string | null;
  title: string;
  body: string | null;
  href: string | null;
  embed?: string | null;
  imageMime: string | null;
  tournamentId?: string | null;
  updatedAt: Date;
};

function toPublicAd(row: AdRow): PublicAd {
  return {
    id: row.id,
    kind: normalizeAdKind(row.kind),
    provider: parseAdProvider(row.provider),
    title: row.title,
    body: row.body,
    href: row.href,
    embed: row.embed ?? null,
    hasImage: Boolean(row.imageMime),
    slides: [],
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function slidesForAd(adId: string) {
  try {
    const rows = await prisma.$queryRaw<{ id: string; createdAt: Date }[]>`
      SELECT id, createdAt FROM AdSlide WHERE adId = ${adId} ORDER BY sortOrder ASC, createdAt ASC
    `;
    return rows.map((row) => ({ id: row.id, createdAt: row.createdAt.toISOString() }));
  } catch {
    return [];
  }
}

export async function listAdSlides() {
  try {
    return await prisma.$queryRaw<{ id: string; adId: string; createdAt: Date }[]>`
      SELECT id, adId, createdAt FROM AdSlide ORDER BY sortOrder ASC, createdAt ASC
    `;
  } catch {
    return [];
  }
}

function pickAd(rows: AdRow[], kind: AdKind, tournamentId?: string | null) {
  const matches = rows.filter((row) => normalizeAdKind(row.kind) === kind);
  if (tournamentId) {
    const specific = matches.find((row) => row.tournamentId === tournamentId);
    if (specific) return toPublicAd(specific);
  }
  const global = matches.find((row) => !row.tournamentId);
  return global ? toPublicAd(global) : null;
}

/** Sin torneo: solo anuncios de toda la aplicación. Con torneo: el de ese torneo, o el general si no hay. */
export async function loadPublicAds(tournamentId?: string | null) {
  try {
    const rows = tournamentId
      ? await prisma.$queryRaw<AdRow[]>`
          SELECT id, kind, provider, title, body, href, embed, imageMime, tournamentId, updatedAt
          FROM Ad
          WHERE active = true AND (tournamentId IS NULL OR tournamentId = ${tournamentId})
          ORDER BY sortOrder ASC, createdAt DESC
        `
      : await prisma.$queryRaw<AdRow[]>`
          SELECT id, kind, provider, title, body, href, embed, imageMime, tournamentId, updatedAt
          FROM Ad
          WHERE active = true AND tournamentId IS NULL
          ORDER BY sortOrder ASC, createdAt DESC
        `;
    const wide = pickAd(rows, "WIDE", tournamentId);
    if (wide) wide.slides = await slidesForAd(wide.id);
    return {
      interstitial: pickAd(rows, "INTERSTITIAL", tournamentId),
      banner: pickAd(rows, "BANNER", tournamentId),
      wide,
    };
  } catch {
    return { interstitial: null, banner: null, wide: null };
  }
}

export async function loadAdminAds() {
  try {
  return await prisma.$queryRaw<
    {
      id: string;
      kind: string;
      provider: string;
      title: string;
      body: string | null;
      href: string | null;
      embed: string | null;
      imageMime: string | null;
      active: boolean | number;
      sortOrder: number;
      views: number | bigint;
      tournamentId: string | null;
      tournamentName: string | null;
      updatedAt: Date;
    }[]
  >`
    SELECT a.id, a.kind, a.provider, a.title, a.body, a.href, a.embed, a.imageMime,
           a.active, a.sortOrder, a.views, a.tournamentId, t.name AS tournamentName, a.updatedAt
    FROM Ad a
    LEFT JOIN Tournament t ON t.id = a.tournamentId
    ORDER BY a.sortOrder ASC, a.createdAt DESC
  `;
  } catch {
    return [];
  }
}
