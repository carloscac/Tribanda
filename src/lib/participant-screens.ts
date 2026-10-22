import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/session-user";

export const PARTICIPANT_SCREEN_KEYS = [
  "inicio",
  "grupos",
  "cuadro",
  "mesas",
  "stats",
  "tv",
] as const;

export type ParticipantScreenKey = (typeof PARTICIPANT_SCREEN_KEYS)[number];

export type ParticipantScreens = Record<ParticipantScreenKey, boolean>;

export const PARTICIPANT_SCREEN_LABEL: Record<ParticipantScreenKey, string> = {
  inicio: "Inicio (resumen)",
  grupos: "Grupos",
  cuadro: "Cuadro",
  mesas: "Mesas en vivo",
  stats: "Estadísticas",
  tv: "Pantalla TV",
};

const DEFAULT_JSON =
  '{"inicio":true,"grupos":true,"cuadro":true,"mesas":true,"stats":true,"tv":true}';

export function defaultParticipantScreens(): ParticipantScreens {
  return Object.fromEntries(PARTICIPANT_SCREEN_KEYS.map((k) => [k, true])) as ParticipantScreens;
}

export function parseParticipantScreens(raw: string | null | undefined): ParticipantScreens {
  const base = { ...defaultParticipantScreens() };
  if (!raw?.trim()) return base;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const key of PARTICIPANT_SCREEN_KEYS) {
      if (typeof parsed[key] === "boolean") base[key] = parsed[key];
    }
  } catch {
    /* defaults */
  }
  return base;
}

export function serializeParticipantScreens(screens: ParticipantScreens): string {
  return JSON.stringify(screens);
}

export function readParticipantScreensFromForm(formData: FormData): ParticipantScreens {
  const screens = defaultParticipantScreens();
  for (const key of PARTICIPANT_SCREEN_KEYS) {
    screens[key] = formData.get(`participantScreen_${key}`) === "on";
  }
  if (!PARTICIPANT_SCREEN_KEYS.some((k) => screens[k])) {
    screens.inicio = true;
  }
  return screens;
}

/** Organizador del torneo y admin ven todas las pantallas en /t/… (vista previa). */
export async function resolveVisibleParticipantScreens(
  tournamentUserId: string,
  configured: ParticipantScreens,
): Promise<ParticipantScreens> {
  const user = await getSessionUser();
  if (user?.role === "ADMIN") return defaultParticipantScreens();
  if (user?.role === "ORGANIZER" && user.id === tournamentUserId) {
    return defaultParticipantScreens();
  }
  return configured;
}

export async function assertParticipantScreenVisible(
  tournamentUserId: string,
  configured: ParticipantScreens,
  screen: ParticipantScreenKey,
) {
  const visible = await resolveVisibleParticipantScreens(tournamentUserId, configured);
  if (!visible[screen]) notFound();
}

export function publicPathForScreen(slug: string, screen: ParticipantScreenKey): string {
  if (screen === "inicio") return `/t/${slug}`;
  return `/t/${slug}/${screen}`;
}
