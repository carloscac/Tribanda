"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { assignDirectBracketSlots } from "@/lib/actions/play-in";

export function DirectPassPanel({
  tournamentId,
  bracketSize,
  slotsStillNeeded,
  candidates,
}: {
  tournamentId: string;
  bracketSize: number;
  slotsStillNeeded: number;
  candidates: { id: string; name: string; groupName: string; note: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, fd: FormData) =>
      assignDirectBracketSlots(fd),
    null,
  );
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      setPicked(new Set());
      router.refresh();
    }
  }, [state?.ok, router]);

  const sorted = useMemo(
    () => [...candidates].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [candidates],
  );

  if (slotsStillNeeded <= 0 || candidates.length === 0) return null;

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < slotsStillNeeded) next.add(id);
      return next;
    });
  };

  return (
    <section className="mt-6 border-t border-line pt-4">
      <h3 className="font-serif text-lg">Pase directo al cuadro (sin repesca)</h3>
      <p className="mt-1 text-sm text-muted">
        Si no hay más repesca o inscripciones, elige hasta{" "}
        <strong className="text-cream">{slotsStillNeeded}</strong> jugador
        {slotsStillNeeded === 1 ? "" : "es"} inscrito{slotsStillNeeded === 1 ? "" : "s"} para
        completar el cuadro sin partido de ajuste.
      </p>
      <form action={formAction} className="mt-3 grid gap-3">
        <input type="hidden" name="tournamentId" value={tournamentId} />
        <input type="hidden" name="bracketSize" value={bracketSize} />
        {[...picked].map((id) => (
          <input key={id} type="hidden" name="inscriptionId" value={id} />
        ))}
        <ul className="max-h-56 overflow-y-auto rounded-lg border border-line divide-y divide-line">
          {sorted.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={picked.has(c.id)}
                  onChange={() => toggle(c.id)}
                />
                <span className="text-cream">{c.name}</span>
                <span className="text-muted">
                  · {c.groupName}
                  {c.note ? ` · ${c.note}` : ""}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <button
          type="submit"
          className="btn btn-ghost max-w-md border border-line"
          disabled={pending || picked.size === 0}
        >
          {pending
            ? "Guardando…"
            : `Asignar ${picked.size} plaza${picked.size === 1 ? "" : "s"} al cuadro`}
        </button>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        {state?.ok && <p className="text-sm text-felt">Plazas actualizadas.</p>}
      </form>
    </section>
  );
}
