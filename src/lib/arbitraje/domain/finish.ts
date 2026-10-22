/**
 * Cierre de partido.
 * Fuente: `decideWinner` en `Torneos/web/src/lib/scoring.ts`.
 * `equalInnings` se conserva en el tipo porque el torneo lo guarda,
 * pero la función actual del servidor no ramifica con ese campo.
 */
export type ScoreInput = {
  caromsA: number;
  caromsB: number;
  innings: number;
  distanceA: number;
  distanceB: number;
  equalInnings: boolean;
  maxInnings: number | null;
};

export type ScoreDecision =
  | { winner: "A" | "B"; reason: "llego_a_meta" | "limite_entradas" }
  | { error: string };

export function decideWinner(input: ScoreInput): ScoreDecision {
  const { caromsA, caromsB, innings, distanceA, distanceB, maxInnings } = input;

  if (caromsA < 0 || caromsB < 0 || innings < 0) {
    return { error: "Los números no pueden ser negativos." };
  }
  if (distanceA < 1 || distanceB < 1) {
    return { error: "Faltan las distancias del partido." };
  }

  const pctA = caromsA / distanceA;
  const pctB = caromsB / distanceB;
  const aReached = caromsA >= distanceA;
  const bReached = caromsB >= distanceB;
  const atLimit = maxInnings != null && innings >= maxInnings;

  if (!aReached && !bReached) {
    if (atLimit) {
      if (pctA > pctB) return { winner: "A", reason: "limite_entradas" };
      if (pctB > pctA) return { winner: "B", reason: "limite_entradas" };
      return {
        error:
          "Empate de porcentaje al límite de entradas. Usa penaltis o elige quién pasa.",
      };
    }
    return { error: "Nadie llegó a su meta. Sigue anotando o indica el límite de entradas." };
  }

  if (aReached && !bReached) return { winner: "A", reason: "llego_a_meta" };
  if (bReached && !aReached) return { winner: "B", reason: "llego_a_meta" };

  if (pctA > pctB) return { winner: "A", reason: "llego_a_meta" };
  if (pctB > pctA) return { winner: "B", reason: "llego_a_meta" };
  return { error: "Ambos llegaron empatados. Registra penaltis o decide quién pasa." };
}

export function isFinished(status: string) {
  return status === "CLOSED" || status === "WALKOVER";
}
