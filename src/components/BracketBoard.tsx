"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { generateKnockout } from "@/lib/actions/groups";
import { BracketTree, type TreeMatch } from "@/components/bracket/BracketTree";
import { KnockoutGenerateFields } from "@/components/KnockoutGenerateFields";
import { predrawSlotLabel } from "@/lib/bracket-predraw";
import { parseKnockoutLayout, type KnockoutLayout } from "@/lib/knockout-format";
import { ManualResultForm, type ManualResultMatch } from "@/components/ManualResultForm";

type Side = {
  id: string;
  player: { name: string; photoUrl: string | null };
} | null;

export type KoMatch = {
  id: string;
  round: number;
  bracketSlot: number | null;
  status: string;
  closeReason: string | null;
  winnerId: string | null;
  sideAId: string | null;
  sideBId: string | null;
  caromsA: number | null;
  caromsB: number | null;
  distanceA: number;
  distanceB: number;
  innings: number | null;
  highRunA: number | null;
  highRunB: number | null;
  sideAGroupOrder: number | null;
  sideBGroupOrder: number | null;
  sideAPlace: number | null;
  sideBPlace: number | null;
  sideA: Side;
  sideB: Side;
};

function groupNameMap(names: Record<string, string> | undefined) {
  const map = new Map<number, string>();
  for (const [order, name] of Object.entries(names ?? {})) {
    const n = Number(order);
    if (Number.isInteger(n)) map.set(n, name);
  }
  return map;
}

function toTree(match: KoMatch, groupNameByOrder: Map<number, string>): TreeMatch {
  const winner =
    match.winnerId && match.winnerId === match.sideAId
      ? "A"
      : match.winnerId && match.winnerId === match.sideBId
        ? "B"
        : null;
  return {
    id: match.id,
    round: match.round,
    slot: match.bracketSlot ?? 0,
    status: match.status,
    closeReason: match.closeReason,
    tableNumber: null,
    caromsA: match.caromsA,
    caromsB: match.caromsB,
    winner,
    playerA: {
      name:
        match.sideA?.player.name ??
        (match.closeReason === "bye"
          ? "BYE"
          : predrawSlotLabel(match.sideAGroupOrder, match.sideAPlace, groupNameByOrder)),
      photoUrl: match.sideA?.player.photoUrl ?? null,
      distance: match.sideA ? match.distanceA : null,
    },
    playerB: {
      name:
        match.sideB?.player.name ??
        (match.closeReason === "bye"
          ? "BYE"
          : predrawSlotLabel(match.sideBGroupOrder, match.sideBPlace, groupNameByOrder)),
      photoUrl: match.sideB?.player.photoUrl ?? null,
      distance: match.sideB ? match.distanceB : null,
    },
  };
}

function toManualMatch(match: KoMatch, requireInnings: boolean): ManualResultMatch | null {
  if (!match.sideAId || !match.sideBId || !match.sideA || !match.sideB) return null;
  return {
    id: match.id,
    sideAId: match.sideAId,
    sideBId: match.sideBId,
    nameA: match.sideA.player.name,
    nameB: match.sideB.player.name,
    distanceA: match.distanceA,
    distanceB: match.distanceB,
    caromsA: match.caromsA,
    caromsB: match.caromsB,
    innings: match.innings,
    highRunA: match.highRunA,
    highRunB: match.highRunB,
    requireInnings,
  };
}

export function BracketBoard({
  tournamentId,
  matches,
  canGenerate,
  canRegenerate,
  requireInnings,
  knockoutLayout,
  qualifiedCount,
  poolSize,
  knockoutPreDraw = false,
  groupNames,
}: {
  tournamentId: string;
  matches: KoMatch[];
  canGenerate: boolean;
  canRegenerate: boolean;
  requireInnings: boolean;
  knockoutLayout: KnockoutLayout | string;
  qualifiedCount: number;
  poolSize: number;
  knockoutPreDraw?: boolean;
  groupNames?: Record<string, string>;
}) {
  const groupNameByOrder = groupNameMap(groupNames);
  const layout = parseKnockoutLayout(knockoutLayout);
  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      generateKnockout(formData),
    null,
  );

  const totalRounds = matches.reduce((max, match) => Math.max(max, match.round), 1);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const byId = new Map(matches.map((match) => [match.id, match]));
  const scoringMatch = scoringId ? (byId.get(scoringId) ?? null) : null;
  const scoringManual = scoringMatch ? toManualMatch(scoringMatch, requireInnings) : null;
  const scoringOpen = Boolean(
    scoringMatch &&
      scoringManual &&
      (scoringMatch.status === "SCHEDULED" || scoringMatch.status === "LIVE") &&
      scoringMatch.closeReason !== "bye",
  );

  useEffect(() => {
    if (!scoringOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setScoringId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scoringOpen]);

  return (
    <div className="grid gap-6">
      {!knockoutPreDraw && (canGenerate || canRegenerate) && (
        <div className="card">
          <h2 className="font-serif mb-2 text-xl">
            {matches.length ? "Regenerar cuadro" : "Armar cuadro"}
          </h2>
          <form action={formAction}>
            <input type="hidden" name="tournamentId" value={tournamentId} />
            {poolSize >= 4 && (
              <KnockoutGenerateFields
                knockoutLayout={layout}
                qualifiedCount={qualifiedCount}
                poolSize={poolSize}
              />
            )}
            <button className="btn btn-primary max-w-xs" type="submit" disabled={pending || poolSize < 4}>
              {pending ? "Armando…" : matches.length ? "Volver a armar" : "Generar cuadro"}
            </button>
            {state && "error" in state && state.error && (
              <p className="mt-2 text-sm text-danger">{state.error}</p>
            )}
          </form>
        </div>
      )}

      {knockoutPreDraw && matches.length > 0 && (
        <p className="text-sm text-muted">
          Cuadro prefijado desde los grupos. Las plazas muestran puesto y grupo hasta que cierra la
          clasificación; luego aparecen los nombres.
        </p>
      )}

      {matches.length === 0 ? (
        <p className="text-sm text-muted">
          {knockoutPreDraw
            ? "Genera los partidos de grupos para crear el cuadro prefijado."
            : "Todavía no hay cuadro. Termina los grupos y resuelve los empates, luego genéralo aquí."}
        </p>
      ) : (
        <BracketTree
          matches={matches.map((m) => toTree(m, groupNameByOrder))}
          totalRounds={totalRounds}
          layout={layout}
          renderExtra={(slot) => {
            const match = byId.get(slot.id);
            if (!match) return null;
            const manual = toManualMatch(match, requireInnings);
            const canScore =
              (match.status === "SCHEDULED" || match.status === "LIVE") &&
              match.closeReason !== "bye" &&
              manual;
            if (!canScore) return null;
            return (
              <button
                type="button"
                className="block max-w-full truncate text-left text-[11px] leading-4 text-gold underline decoration-gold/40 underline-offset-2"
                onClick={() => setScoringId(match.id)}
              >
                Cargar resultado
              </button>
            );
          }}
        />
      )}
      {scoringOpen && scoringManual && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
              <button
                type="button"
                className="absolute inset-0 bg-navy/75"
                aria-label="Cerrar"
                onClick={() => setScoringId(null)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="bracket-result-title"
                className="relative max-h-[min(92vh,820px)] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-paper p-5 shadow-2xl"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h2 id="bracket-result-title" className="font-serif text-xl">
                    {scoringManual.nameA} vs {scoringManual.nameB}
                  </h2>
                  <button
                    type="button"
                    className="btn btn-ghost px-2 py-1 text-sm"
                    onClick={() => setScoringId(null)}
                  >
                    Cerrar
                  </button>
                </div>
                <ManualResultForm match={scoringManual} onCancel={() => setScoringId(null)} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
