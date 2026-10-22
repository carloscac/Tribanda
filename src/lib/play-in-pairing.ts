import { shuffle } from "@/lib/groups";
import type { PlayInKind } from "@/lib/play-in-setup";

export type RepescaPlayer = { inscriptionId: string; distance: number };
export type PlayInPairPlan = {
  sideAId: string;
  sideBId: string;
  playInKind: PlayInKind;
};

/** Cupos vacíos: repesca vs repesca. Sobrantes: repesca vs 2.º clasificado. */
export function planAutomaticPlayInMatches(
  pool: RepescaPlayer[],
  slotsNeeded: number,
  secondQualifiedIds: string[],
): { plans: PlayInPairPlan[] } | { error: string } {
  if (slotsNeeded <= 0) {
    return { error: "No hay cupos vacíos que completar." };
  }

  const needForVacant = slotsNeeded * 2;
  if (pool.length < needForVacant) {
    return {
      error: `Para llenar ${slotsNeeded} cupo${slotsNeeded === 1 ? "" : "s"} vacío${slotsNeeded === 1 ? "" : "s"} hacen falta ${needForVacant} jugadores en repesca (hay ${pool.length}). Marca «Sí repesca» en la lista de segundos de grupo.`,
    };
  }

  const shuffled = shuffle([...pool]);
  const plans: PlayInPairPlan[] = [];

  for (let i = 0; i < slotsNeeded; i += 1) {
    const a = shuffled[i * 2];
    const b = shuffled[i * 2 + 1];
    plans.push({
      sideAId: a.inscriptionId,
      sideBId: b.inscriptionId,
      playInKind: "ELIM_VS_ELIM",
    });
  }

  const remainder = shuffled.slice(needForVacant);
  if (remainder.length === 0) {
    return { plans };
  }

  const seconds = shuffle([...secondQualifiedIds]);
  if (seconds.length < remainder.length) {
    return {
      error: `Quedan ${remainder.length} jugador${remainder.length === 1 ? "" : "es"} de repesca sin duelo por cupo vacío; hacen falta ${remainder.length} segundo${remainder.length === 1 ? "" : "s"} clasificado${remainder.length === 1 ? "" : "s"} para retar (hay ${seconds.length}).`,
    };
  }

  for (let j = 0; j < remainder.length; j += 1) {
    plans.push({
      sideAId: remainder[j].inscriptionId,
      sideBId: seconds[j],
      playInKind: "ELIM_VS_QUALIFIED",
    });
  }

  return { plans };
}
