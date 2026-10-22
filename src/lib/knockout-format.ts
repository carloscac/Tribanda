import { nextPowerOfTwo } from "@/lib/bracket";

export const KNOCKOUT_LAYOUTS = ["COLUMNS", "SPLIT"] as const;
export type KnockoutLayout = (typeof KNOCKOUT_LAYOUTS)[number];

export const BRACKET_SIZES = [4, 8, 16, 32, 64] as const;
export type BracketSize = (typeof BRACKET_SIZES)[number];

export function parseKnockoutLayout(raw: string | null | undefined): KnockoutLayout {
  return raw === "SPLIT" ? "SPLIT" : "COLUMNS";
}

export function knockoutLayoutLabel(layout: KnockoutLayout) {
  if (layout === "SPLIT") return "Espejo al centro";
  return "Columnas (estándar)";
}

export function parseBracketSize(raw: FormDataEntryValue | null | undefined): number | null {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isInteger(n)) return null;
  if (!(BRACKET_SIZES as readonly number[]).includes(n)) return null;
  return n;
}

export function suggestBracketSize(qualifiedCount: number, poolSize: number) {
  const need = Math.max(qualifiedCount, 2);
  const sized = nextPowerOfTwo(need);
  const cap = nextPowerOfTwo(Math.max(poolSize, 2));
  return Math.min(sized, cap) as BracketSize;
}

/** Incluye el siguiente 2^n aunque el pool no lo llene (el resto son byes / ajuste). */
export function allowedBracketSizes(poolSize: number, qualifiedCount = 0): BracketSize[] {
  const cap = nextPowerOfTwo(Math.max(poolSize, qualifiedCount, 2));
  const sizes = BRACKET_SIZES.filter((n) => n <= cap);
  return sizes.length > 0 ? [...sizes] : [4];
}

/** Menor cuadro 2^n donde los que no tienen pase caben en una ronda de ajuste. */
export function suggestPlayInBracketSize(directFirsts: number, listCount: number): BracketSize {
  const pass = Math.max(0, directFirsts);
  for (const size of BRACKET_SIZES) {
    if (size < Math.max(pass, 4)) continue;
    const slots = size - pass;
    if (listCount <= slots * 2) return size;
  }
  return 32;
}

/** Mitad izquierda del cuadro (la final queda al centro). */
export function matchInLeftHalf(round: number, slot: number, totalRounds: number) {
  if (round >= totalRounds) return false;
  const threshold = 2 ** (totalRounds - round - 1);
  return slot < threshold;
}
