"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { Category, Inscription, Player } from "@prisma/client";
import { replaceInscriptionPlayer } from "@/lib/actions/inscriptions";
import { playerOptionLabel } from "@/lib/player-label";

type PlayerView = Omit<Player, "photoData">;
type BenchRow = Inscription & { player: PlayerView; category: Category | null };

export function ReplacePlayerForm({
  inscriptionId,
  outgoingName,
  defaultCategoryId,
  defaultDistance,
  defaultPaid,
  categories,
  availablePlayers,
  benchInscriptions,
  onDone,
  onCancel,
}: {
  inscriptionId: string;
  outgoingName: string;
  defaultCategoryId: string;
  defaultDistance: number;
  defaultPaid: boolean;
  categories: Category[];
  availablePlayers: (PlayerView & { category: Category | null })[];
  benchInscriptions: BenchRow[];
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const defaultSource = availablePlayers.length
    ? "player"
    : benchInscriptions.length
      ? "bench"
      : "new";
  const [source, setSource] = useState(defaultSource);
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [distance, setDistance] = useState(String(defaultDistance));

  const [state, action, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      replaceInscriptionPlayer(formData),
    null,
  );

  useEffect(() => {
    if (state && "ok" in state && state.ok) onDone?.();
  }, [state, onDone]);

  const categoryOptions = useMemo(
    () => categories.filter((c) => c.active || c.id === defaultCategoryId),
    [categories, defaultCategoryId],
  );

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="inscriptionId" value={inscriptionId} />
      <input type="hidden" name="source" value={source} />
      <p className="text-sm text-muted">
        {outgoingName} sale. Quien entre ocupa el mismo grupo y los mismos partidos. No se vuelve a
        sortear.
      </p>
      <fieldset className="grid gap-2 text-sm">
        {availablePlayers.length > 0 && (
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="sourceUi"
              checked={source === "player"}
              onChange={() => setSource("player")}
            />
            De la agenda
          </label>
        )}
        {benchInscriptions.length > 0 && (
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="sourceUi"
              checked={source === "bench"}
              onChange={() => setSource("bench")}
            />
            Inscrito que no quedó en grupo
          </label>
        )}
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="sourceUi"
            checked={source === "new"}
            onChange={() => setSource("new")}
          />
          Persona nueva
        </label>
      </fieldset>

      {source === "player" && (
        <div className="field">
          <label htmlFor={`rep-player-${inscriptionId}`}>Quién entra</label>
          <select id={`rep-player-${inscriptionId}`} name="playerId" required>
            {availablePlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {playerOptionLabel(p)}
              </option>
            ))}
          </select>
        </div>
      )}

      {source === "bench" && (
        <div className="field">
          <label htmlFor={`rep-bench-${inscriptionId}`}>Quién entra</label>
          <select id={`rep-bench-${inscriptionId}`} name="benchInscriptionId" required>
            {benchInscriptions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.player.name}
                {row.category ? ` · ${row.category.name}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {source === "new" && (
        <>
          <div className="field">
            <label htmlFor={`rep-name-${inscriptionId}`}>Nombre</label>
            <input id={`rep-name-${inscriptionId}`} name="name" required minLength={2} />
          </div>
          <div className="field">
            <label htmlFor={`rep-doc-${inscriptionId}`}>Cédula</label>
            <input
              id={`rep-doc-${inscriptionId}`}
              name="documentId"
              inputMode="numeric"
              required
              placeholder="Entrada a la app"
            />
          </div>
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="field">
          <label htmlFor={`rep-cat-${inscriptionId}`}>Categoría</label>
          <select
            id={`rep-cat-${inscriptionId}`}
            name="categoryId"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              const cat = categories.find((c) => c.id === e.target.value);
              if (cat) setDistance(String(cat.distance));
            }}
          >
            <option value="">—</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (a {c.distance})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`rep-dist-${inscriptionId}`}>Distancia</label>
          <input
            id={`rep-dist-${inscriptionId}`}
            name="distance"
            type="number"
            min={1}
            max={80}
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="paid" defaultChecked={defaultPaid} />
        Ya pagó
      </label>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Sustituyendo…" : "Sustituir en el grupo"}
        </button>
        {onCancel && (
          <button className="btn btn-ghost" type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
      {state && "error" in state && state.error && (
        <p className="text-sm text-danger">{state.error}</p>
      )}
    </form>
  );
}
