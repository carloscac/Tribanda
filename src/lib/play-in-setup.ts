export const PLAY_IN_KINDS = ["ELIM_VS_ELIM", "ELIM_VS_QUALIFIED", "QUALIFIED_CONFIRM"] as const;
export type PlayInKind = (typeof PLAY_IN_KINDS)[number];

export const PLAY_IN_KIND_LABEL: Record<PlayInKind, string> = {
  ELIM_VS_ELIM: "Repesca vs repesca (gana un cupo vacío)",
  ELIM_VS_QUALIFIED: "Repesca vs 2.º clasificado (puede quitarle el cupo)",
  QUALIFIED_CONFIRM: "Clasificado confirma plaza ante repesca",
};

/** Filas sugeridas: primero cupos vacíos, luego retos a 2.º con repesca sobrante. */
export function playInAssignedInscriptionIds(
  matches: { sideAId?: string | null; sideBId?: string | null }[],
) {
  const ids = new Set<string>();
  for (const m of matches) {
    if (m.sideAId) ids.add(m.sideAId);
    if (m.sideBId) ids.add(m.sideBId);
  }
  return ids;
}

export function suggestRepescaMatchRows(extraNeeded: number, _repescaConfirmed?: number) {
  const rows: { kind: PlayInKind }[] = [];
  for (let i = 0; i < extraNeeded; i += 1) {
    rows.push({ kind: "ELIM_VS_ELIM" });
  }
  return rows;
}
