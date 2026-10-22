import { formatAverage, playerAverage } from "@/lib/dashboard";

export function careerAverage(caroms: number, innings: number) {
  if (innings < 1) return null;
  return playerAverage(caroms, innings);
}

export function formatCareerAverage(value: number | null) {
  if (value == null) return "—";
  return formatAverage(value);
}

/** Sugerencia de distancia: +2 carambolas por campeonato (el organizador confirma). */
export function suggestedHandicap(opts: {
  current: number | null;
  championships: number;
  categoryDistance: number | null;
}) {
  const base = opts.current ?? opts.categoryDistance ?? 15;
  if (opts.championships <= 0) return base;
  return base + opts.championships * 2;
}

export function playerOptionLabel(player: {
  code?: string | null;
  name: string;
  club?: string | null;
  documentId?: string | null;
  category?: { name: string } | null;
}) {
  const code = player.code ? `${player.code} · ` : "";
  const club = player.club ? ` · ${player.club}` : "";
  const category = player.category ? ` · ${player.category.name}` : "";
  const missingDoc = player.documentId ? "" : " · sin cédula";
  return `${code}${player.name}${club}${category}${missingDoc}`;
}
