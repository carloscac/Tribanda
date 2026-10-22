"use client";

import { useActionState } from "react";
import { updatePlayerHandicap } from "@/lib/actions/players";

export function HandicapForm({
  playerId,
  current,
  suggested,
}: {
  playerId: string;
  current: number | null;
  suggested: number;
}) {
  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      updatePlayerHandicap(formData),
    null,
  );

  return (
    <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={playerId} />
      <div className="field">
        <label htmlFor="handicap">Nuevo handicap (distancia)</label>
        <input
          id="handicap"
          name="handicap"
          type="number"
          min={1}
          max={80}
          defaultValue={current ?? suggested}
          required
        />
        <p className="text-xs text-muted">Sugerido por palmarés: {suggested}</p>
      </div>
      <div className="field">
        <label htmlFor="handicap-reason">Motivo</label>
        <input id="handicap-reason" name="reason" placeholder="Título, promedio, decisión del club…" />
      </div>
      {state?.error && <p className="text-sm text-danger sm:col-span-2">{state.error}</p>}
      {state?.ok && <p className="text-sm text-felt sm:col-span-2">Handicap actualizado.</p>}
      <div className="sm:col-span-2">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar handicap"}
        </button>
      </div>
    </form>
  );
}