export function statusBadgeClass(status: string) {
  if (status === "LIVE") return "badge badge-live";
  if (status === "REGISTRATION") return "badge badge-info";
  if (status === "CLOSED") return "badge badge-muted";
  return "badge badge-draft";
}

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  REGISTRATION: "Inscripción",
  LIVE: "En curso",
  CLOSED: "Cerrado",
};

export const MIX_LABEL: Record<string, string> = {
  MIXED: "Todas las categorías",
  SINGLE: "Una categoría",
};

export function rosterCountLabel(registered: number, expected: number | null | undefined) {
  if (expected != null && expected > 0) {
    return `${registered} de ${expected} registrados`;
  }
  return `${registered} ${registered === 1 ? "registrado" : "registrados"}`;
}

export function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function parseCOP(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return Number.NaN;
  return Number(digits);
}

export function placeLabel(place: number) {
  return `${place}º`;
}

export const DEFAULT_CATEGORIES = [
  { name: "Primera", distance: 18, sortOrder: 1 },
  { name: "Segunda", distance: 15, sortOrder: 2 },
  { name: "Tercera", distance: 12, sortOrder: 3 },
] as const;
