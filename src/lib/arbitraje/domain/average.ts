/**
 * Promedio de Tribanda.
 * Fuente: `playerAverage` y `formatAverage` en `Torneos/web/src/lib/dashboard.ts`.
 * Fórmula: carambolas / entradas, si las entradas son al menos 1. Si no, 0.
 * No se redondea en el dominio; la presentación usa tres decimales.
 */
export function playerAverage(caroms: number, innings: number) {
  if (innings < 1) return 0;
  return caroms / innings;
}

export function formatAverage(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0.000";
  return value.toFixed(3);
}
