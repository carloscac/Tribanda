"use client";

import { useActionState, useMemo, useState } from "react";
import { closeMatch, walkoverMatch } from "@/lib/actions/matches";

export type ManualResultMatch = {
  id: string;
  sideAId: string;
  sideBId: string;
  nameA: string;
  nameB: string;
  distanceA: number;
  distanceB: number;
  caromsA?: number | null;
  caromsB?: number | null;
  innings?: number | null;
  highRunA?: number | null;
  highRunB?: number | null;
  requireInnings?: boolean;
};

function guessWinner(input: {
  caromsA: string;
  caromsB: string;
  distanceA: number;
  distanceB: number;
  sideAId: string;
  sideBId: string;
}) {
  const a = Number(input.caromsA);
  const b = Number(input.caromsB);
  if (!Number.isInteger(a) || !Number.isInteger(b)) return "";
  const aReached = a >= input.distanceA;
  const bReached = b >= input.distanceB;
  if (aReached && !bReached) return input.sideAId;
  if (bReached && !aReached) return input.sideBId;
  if (aReached && bReached) {
    const pctA = a / input.distanceA;
    const pctB = b / input.distanceB;
    if (pctA > pctB) return input.sideAId;
    if (pctB > pctA) return input.sideBId;
  }
  return "";
}

export function ManualResultForm({
  match,
  onCancel,
}: {
  match: ManualResultMatch;
  onCancel?: () => void;
}) {
  const [caromsA, setCaromsA] = useState(match.caromsA == null ? "" : String(match.caromsA));
  const [caromsB, setCaromsB] = useState(match.caromsB == null ? "" : String(match.caromsB));
  const [winnerId, setWinnerId] = useState("");

  const suggested = useMemo(
    () =>
      guessWinner({
        caromsA,
        caromsB,
        distanceA: match.distanceA,
        distanceB: match.distanceB,
        sideAId: match.sideAId,
        sideBId: match.sideBId,
      }),
    [caromsA, caromsB, match.distanceA, match.distanceB, match.sideAId, match.sideBId],
  );

  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      closeMatch(formData),
    null,
  );

  return (
    <form action={formAction} className="grid gap-3 rounded-lg border border-line bg-navy/40 p-3">
      <input type="hidden" name="matchId" value={match.id} />
      <p className="text-sm font-semibold">Resultado en papel</p>
      <p className="text-xs text-muted">
        {match.requireInnings
          ? "Si no marcaste en vivo, carga carambolas, entradas, tacada mayor y quién ganó."
          : "Si no marcaste en vivo, carga carambolas, tacada mayor y quién ganó. Las entradas son opcionales."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2 rounded-lg border border-line p-2">
          <p className="text-sm font-medium">
            {match.nameA} <span className="text-muted">a {match.distanceA}</span>
          </p>
          <label className="field">
            <span>Carambolas</span>
            <input
              name="caromsA"
              type="number"
              min={0}
              required
              value={caromsA}
              onChange={(e) => {
                setCaromsA(e.target.value);
                const next = guessWinner({
                  caromsA: e.target.value,
                  caromsB,
                  distanceA: match.distanceA,
                  distanceB: match.distanceB,
                  sideAId: match.sideAId,
                  sideBId: match.sideBId,
                });
                if (next) setWinnerId(next);
              }}
            />
          </label>
          <label className="field">
            <span>Tacada mayor</span>
            <input
              name="highRunA"
              type="number"
              min={0}
              defaultValue={match.highRunA ?? ""}
            />
          </label>
        </div>
        <div className="grid gap-2 rounded-lg border border-line p-2">
          <p className="text-sm font-medium">
            {match.nameB} <span className="text-muted">a {match.distanceB}</span>
          </p>
          <label className="field">
            <span>Carambolas</span>
            <input
              name="caromsB"
              type="number"
              min={0}
              required
              value={caromsB}
              onChange={(e) => {
                setCaromsB(e.target.value);
                const next = guessWinner({
                  caromsA,
                  caromsB: e.target.value,
                  distanceA: match.distanceA,
                  distanceB: match.distanceB,
                  sideAId: match.sideAId,
                  sideBId: match.sideBId,
                });
                if (next) setWinnerId(next);
              }}
            />
          </label>
          <label className="field">
            <span>Tacada mayor</span>
            <input
              name="highRunB"
              type="number"
              min={0}
              defaultValue={match.highRunB ?? ""}
            />
          </label>
        </div>
      </div>
      <label className="field max-w-xs">
        <span>{match.requireInnings ? "Entradas" : "Entradas (opcional)"}</span>
        <input
          name="innings"
          type="number"
          min={0}
          required={Boolean(match.requireInnings)}
          defaultValue={match.innings ?? ""}
        />
      </label>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">Ganador</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="winnerId"
            value={match.sideAId}
            checked={winnerId === match.sideAId}
            onChange={() => setWinnerId(match.sideAId)}
            required
          />
          {match.nameA}
          {suggested === match.sideAId ? <span className="text-xs text-gold">según el marcador</span> : null}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="winnerId"
            value={match.sideBId}
            checked={winnerId === match.sideBId}
            onChange={() => setWinnerId(match.sideBId)}
            required
          />
          {match.nameB}
          {suggested === match.sideBId ? <span className="text-xs text-gold">según el marcador</span> : null}
        </label>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar y cerrar"}
        </button>
        {onCancel && (
          <button className="btn btn-ghost" type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <div className="border-t border-line pt-3">
        <p className="mb-2 text-xs text-muted">Si no se jugó: walkover. No cuenta para promedio ni tacada.</p>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-ghost"
            type="submit"
            formNoValidate
            formAction={async () => {
              const data = new FormData();
              data.set("matchId", match.id);
              data.set("winnerId", match.sideAId);
              await walkoverMatch(data);
            }}
          >
            W.O. gana {match.nameA}
          </button>
          <button
            className="btn btn-ghost"
            type="submit"
            formNoValidate
            formAction={async () => {
              const data = new FormData();
              data.set("matchId", match.id);
              data.set("winnerId", match.sideBId);
              await walkoverMatch(data);
            }}
          >
            W.O. gana {match.nameB}
          </button>
        </div>
      </div>
    </form>
  );
}
