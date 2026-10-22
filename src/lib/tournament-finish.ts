export function finishBlockReason(status: string, pendingMatches: number) {
  if (status === "CLOSED") return null;
  if (status !== "LIVE") {
    return "Solo puedes finalizar un torneo que ya está en curso (después de armar grupos).";
  }
  if (pendingMatches > 0) {
    return `Quedan ${pendingMatches} partida${pendingMatches === 1 ? "" : "s"} sin cerrar (en cola o en mesa).`;
  }
  return null;
}
