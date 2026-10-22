export const GROUP_TIEBREAKS = ["AVERAGE", "GROUP_ORDER", "CAROMS"] as const;
export type GroupTiebreak = (typeof GROUP_TIEBREAKS)[number];

/** Valor en base de datos para torneos existentes (PG → carambolas → serie). */
export const DEFAULT_GROUP_TIEBREAK: GroupTiebreak = "CAROMS";

/** Valor del formulario al crear un torneo nuevo. */
export const FORM_DEFAULT_GROUP_TIEBREAK: GroupTiebreak = "AVERAGE";

export const GROUP_TIEBREAK_OPTIONS = [
  {
    value: "AVERAGE" as const,
    title: "Clasificación por promedio",
    description:
      "Cuando dos o más deportistas tengan la misma cantidad de partidos ganados, tendrá prioridad el deportista con el mejor promedio de carambolas. Si persiste el empate, se aplicarán los siguientes criterios de desempate definidos por el sistema.",
  },
  {
    value: "GROUP_ORDER" as const,
    title: "Clasificación por grupo",
    description:
      "Cuando dos o más deportistas tengan la misma cantidad de partidos ganados, tendrá prioridad el deportista que pertenezca al grupo con el número más bajo, independientemente de su promedio o de las carambolas realizadas.",
  },
] as const;

export const LEGACY_CAROMS_OPTION = {
  value: "CAROMS" as const,
  title: "Clasificación histórica (carambolas)",
  description:
    "Cuando dos o más deportistas tengan la misma cantidad de partidos ganados, tendrá prioridad quien haya realizado más carambolas. Es el criterio de los torneos creados antes de este ajuste.",
};

export function groupTiebreakShortLabel(mode: GroupTiebreak) {
  if (mode === "AVERAGE") return "partidos ganados y, si hay empate, mejor promedio";
  if (mode === "GROUP_ORDER") return "partidos ganados y, si hay empate, número de grupo (el más bajo primero)";
  return "partidos ganados y, si hay empate, más carambolas";
}

export function parseGroupTiebreak(value: unknown): GroupTiebreak {
  if (value === "AVERAGE" || value === "GROUP_ORDER" || value === "CAROMS") {
    return value;
  }
  return DEFAULT_GROUP_TIEBREAK;
}

export type GroupStandingRow = {
  inscriptionId: string;
  pg: number;
  caroms: number;
  innings?: number | null;
  highRun?: number | null;
  groupSort?: number | null;
};

export function standingAverage(caroms: number, innings: number | null | undefined): number | null {
  if (innings == null || innings <= 0) return null;
  return caroms / innings;
}

export function compareGroupStanding(
  a: GroupStandingRow,
  b: GroupStandingRow,
  mode: GroupTiebreak,
  opts?: { ignoreId?: boolean },
): number {
  if (b.pg !== a.pg) return b.pg - a.pg;

  if (mode === "AVERAGE") {
    const avgA = standingAverage(a.caroms, a.innings);
    const avgB = standingAverage(b.caroms, b.innings);
    const na = avgA ?? Number.NEGATIVE_INFINITY;
    const nb = avgB ?? Number.NEGATIVE_INFINITY;
    if (nb !== na) return nb - na;
  } else if (mode === "GROUP_ORDER") {
    const groupA = a.groupSort ?? Number.POSITIVE_INFINITY;
    const groupB = b.groupSort ?? Number.POSITIVE_INFINITY;
    if (groupA !== groupB) return groupA - groupB;
  } else if (b.caroms !== a.caroms) {
    return b.caroms - a.caroms;
  }

  if (mode !== "CAROMS" && b.caroms !== a.caroms) return b.caroms - a.caroms;

  const highA = a.highRun ?? 0;
  const highB = b.highRun ?? 0;
  if (highB !== highA) return highB - highA;

  if (opts?.ignoreId) return 0;
  return a.inscriptionId.localeCompare(b.inscriptionId);
}

export function sortGroupStandings<T extends GroupStandingRow>(
  rows: T[],
  mode: GroupTiebreak,
): T[] {
  return [...rows].sort((a, b) => compareGroupStanding(a, b, mode));
}

export type WinRow = {
  inscriptionId: string;
  pg: number;
};

/** Empate solo por partidos ganados (comportamiento histórico). */
export function qualificationFromWins(rows: WinRow[], qualifyN: number) {
  const sorted = [...rows].sort((a, b) => b.pg - a.pg);
  const n = Math.min(qualifyN, sorted.length);

  if (sorted.length === 0 || n === 0) {
    return { auto: [] as WinRow[], tie: [] as WinRow[], spots: 0 };
  }

  if (sorted.length <= n) {
    return { auto: sorted, tie: [], spots: 0 };
  }

  const cutoff = sorted[n - 1].pg;
  const auto = sorted.filter((r) => r.pg > cutoff);
  const tie = sorted.filter((r) => r.pg === cutoff);
  const spots = n - auto.length;

  if (tie.length === spots) {
    return { auto: [...auto, ...tie], tie: [], spots: 0 };
  }

  return { auto, tie, spots };
}

/**
 * Clasificación por grupo. AVERAGE y GROUP_ORDER desempatan con el criterio
 * del torneo; CAROMS conserva el empate solo por partidos ganados.
 */
export function qualificationFromStanding<T extends GroupStandingRow>(
  rows: T[],
  qualifyN: number,
  mode: GroupTiebreak,
): { auto: T[]; tie: T[]; spots: number } {
  if (mode === "CAROMS") {
    const legacy = qualificationFromWins(rows, qualifyN);
    return {
      auto: legacy.auto as T[],
      tie: legacy.tie as T[],
      spots: legacy.spots,
    };
  }

  const sorted = sortGroupStandings(rows, mode);
  const n = Math.min(qualifyN, sorted.length);

  if (sorted.length === 0 || n === 0) {
    return { auto: [] as T[], tie: [] as T[], spots: 0 };
  }
  if (sorted.length <= n) {
    return { auto: sorted, tie: [], spots: 0 };
  }

  const cutoff = sorted[n - 1];
  const next = sorted[n];
  if (next && compareGroupStanding(cutoff, next, mode, { ignoreId: true }) === 0) {
    const auto = sorted.filter((row) => compareGroupStanding(row, cutoff, mode, { ignoreId: true }) < 0);
    const tie = sorted.filter((row) => compareGroupStanding(row, cutoff, mode, { ignoreId: true }) === 0);
    return { auto, tie, spots: n - auto.length };
  }

  return { auto: sorted.slice(0, n), tie: [], spots: 0 };
}
