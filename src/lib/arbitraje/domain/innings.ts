/**
 * Entrada de una visita nueva.
 * Fuente: `inningForNewVisit` en `Torneos/web/src/lib/dashboard.ts`.
 * A cierra y B abre la misma entrada. Cuando B cierra y A vuelve, la entrada sube.
 */
export function inningForNewVisit(
  last: { side: string; inning: number } | undefined,
  side: string,
) {
  if (!last) return 1;
  if (last.side === "A" && side === "B") return last.inning;
  if (last.side === "B" && side === "A") return last.inning + 1;
  return last.inning + 1;
}
