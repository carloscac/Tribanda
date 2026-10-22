"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { Category, Player, Tournament } from "@prisma/client";
import { createAndInscribe, inscribeExistingPlayer } from "@/lib/actions/inscriptions";
import { formatCOP } from "@/lib/labels";
import { DataProcessingConsent } from "@/components/DataProcessingConsent";
import { playerOptionLabel } from "@/lib/player-label";

export function InscribePlayerModal({
  open,
  onClose,
  tournament,
  categories,
  categoryOptions,
  availablePlayers,
  categoryId,
  setCategoryId,
  distance,
  setDistance,
  existPlayerId,
  setExistPlayerId,
  needCedulaForExist,
  selectedCategoryName,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  tournament: Omit<Tournament, "imageData">;
  categories: Category[];
  categoryOptions: Category[];
  availablePlayers: (Omit<Player, "photoData"> & { category: Category | null })[];
  categoryId: string;
  setCategoryId: (id: string) => void;
  distance: string;
  setDistance: (d: string) => void;
  existPlayerId: string;
  setExistPlayerId: (id: string) => void;
  needCedulaForExist: boolean;
  selectedCategoryName: string;
}) {
  const [tab, setTab] = useState<"agenda" | "quick">("agenda");
  const [existState, existAction, existPending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      inscribeExistingPlayer(formData),
    null,
  );
  const [newState, newAction, newPending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      createAndInscribe(formData),
    null,
  );
  const [playerQuery, setPlayerQuery] = useState("");
  const filteredPlayers = useMemo(() => {
    const term = playerQuery.trim().toLowerCase();
    if (!term) return availablePlayers;
    return availablePlayers.filter((p) =>
      playerOptionLabel(p).toLowerCase().includes(term),
    );
  }, [availablePlayers, playerQuery]);

  useEffect(() => {
    const selected = availablePlayers.find((p) => p.id === existPlayerId);
    if (!selected) return;
    if (selected.handicap) setDistance(String(selected.handicap));
    if (selected.categoryId && categoryOptions.some((category) => category.id === selected.categoryId)) {
      setCategoryId(selected.categoryId);
    }
  }, [existPlayerId, availablePlayers, categoryOptions, setCategoryId, setDistance]);

  useEffect(() => {
    const ok =
      (existState && "ok" in existState && existState.ok) ||
      (newState && "ok" in newState && newState.ok);
    if (ok) onSuccess?.();
  }, [existState, newState]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-navy/75"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inscribe-player-title"
        className="relative max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-paper p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="inscribe-player-title" className="font-serif text-xl">
            Inscribir jugador
          </h2>
          <button type="button" className="btn btn-ghost px-2 py-1 text-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <p className="mb-4 text-sm text-muted">
          La <strong className="text-ink">cédula</strong> permite entrar en Soy participante (usuario y
          contraseña = mismo número). En Nuevo deportista el <strong className="text-ink">celular</strong>{" "}
          sirve para avisos por WhatsApp.
        </p>

        <div className="mb-4 flex gap-2 border-b border-line pb-2">
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-sm ${tab === "agenda" ? "bg-felt text-cream" : "text-muted"}`}
            onClick={() => setTab("agenda")}
          >
            Deportistas
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-sm ${tab === "quick" ? "bg-felt text-cream" : "text-muted"}`}
            onClick={() => setTab("quick")}
          >
            Nuevo deportista
          </button>
        </div>

        {tab === "agenda" && (
          <>
            {availablePlayers.length === 0 ? (
              <p className="text-sm text-muted">
                Todos los deportistas ya están inscritos. Usa Nuevo deportista para registrar a alguien.
              </p>
            ) : (
              <form action={existAction} className="grid gap-3">
                <input type="hidden" name="tournamentId" value={tournament.id} />
                <div className="field">
                  <label htmlFor="modal-player-q">Buscar por código, nombre o cédula</label>
                  <input
                    id="modal-player-q"
                    value={playerQuery}
                    onChange={(e) => setPlayerQuery(e.target.value)}
                    placeholder="TB-… o nombre"
                  />
                </div>
                <div className="field">
                  <label htmlFor="modal-playerId">Deportista</label>
                  <select
                    id="modal-playerId"
                    name="playerId"
                    required
                    value={existPlayerId}
                    onChange={(e) => setExistPlayerId(e.target.value)}
                  >
                    {(filteredPlayers.length ? filteredPlayers : availablePlayers).map((p) => (
                      <option key={p.id} value={p.id}>
                        {playerOptionLabel(p)}
                      </option>
                    ))}
                  </select>
                  {playerQuery.trim() && filteredPlayers.length === 0 ? (
                    <p className="text-xs text-muted">Nadie coincide. Prueba otro término o usa Nuevo deportista.</p>
                  ) : null}
                </div>
                {needCedulaForExist && (
                  <div className="field">
                    <label htmlFor="modal-ex-documentId">Cédula del jugador</label>
                    <input
                      id="modal-ex-documentId"
                      name="documentId"
                      inputMode="numeric"
                      required
                      placeholder="Solo dígitos"
                    />
                  </div>
                )}
                <div className="field">
                  <label htmlFor="modal-ex-cat">Categoría</label>
                  <select
                    id="modal-ex-cat"
                    name="categoryId"
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      const cat = categories.find((c) => c.id === e.target.value);
                      if (cat) setDistance(String(cat.distance));
                    }}
                  >
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (a {c.distance})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="modal-ex-dist">Distancia</label>
                  <input
                    id="modal-ex-dist"
                    name="distance"
                    type="number"
                    min={1}
                    max={80}
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="paid" />
                  Ya pagó
                  {tournament.entryFee ? ` (${formatCOP(tournament.entryFee)})` : ""}
                </label>
                <button className="btn btn-primary w-full" type="submit" disabled={existPending}>
                  {existPending ? "Inscribiendo…" : "Inscribir"}
                </button>
                {existState && "error" in existState && existState.error && (
                  <p className="text-sm text-danger">{existState.error}</p>
                )}
                {existState && "ok" in existState && existState.ok && (
                  <p className="text-sm text-felt">Inscrito. Puedes cerrar o inscribir otro.</p>
                )}
              </form>
            )}
          </>
        )}

        {tab === "quick" && (
          <form action={newAction} className="grid gap-3">
            <input type="hidden" name="tournamentId" value={tournament.id} />
            <input type="hidden" name="categoryId" value={categoryId} />
            <div className="field">
              <label htmlFor="modal-quick-name">Nombre</label>
              <input id="modal-quick-name" name="name" required autoFocus />
            </div>
            <div className="field">
              <label htmlFor="modal-quick-documentId">Cédula</label>
              <input
                id="modal-quick-documentId"
                name="documentId"
                inputMode="numeric"
                required
                placeholder="Entrada a la app con este número"
              />
            </div>
            <div className="field">
              <label htmlFor="modal-quick-phone">Celular</label>
              <input
                id="modal-quick-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                required
                autoComplete="tel"
                placeholder="10 dígitos (WhatsApp)"
              />
              <p className="text-xs text-muted">Obligatorio. Ejemplo: 3001234567</p>
            </div>
            <div className="field">
              <label htmlFor="modal-quick-cat">Categoría</label>
              <select
                id="modal-quick-cat"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  const cat = categories.find((c) => c.id === e.target.value);
                  if (cat) setDistance(String(cat.distance));
                }}
              >
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (a {c.distance})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="modal-quick-dist">Distancia</label>
              <input
                id="modal-quick-dist"
                name="distance"
                type="number"
                min={1}
                max={80}
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted">Categoría: {selectedCategoryName || "—"}</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="paid" />
              Ya pagó
              {tournament.entryFee ? ` (${formatCOP(tournament.entryFee)})` : ""}
            </label>
            <DataProcessingConsent variant="organizer" />
            <button className="btn btn-primary w-full" type="submit" disabled={newPending}>
              {newPending ? "Creando…" : "Crear e inscribir"}
            </button>
            {newState && "error" in newState && newState.error && (
              <p className="text-sm text-danger">{newState.error}</p>
            )}
            {newState && "ok" in newState && newState.ok && (
              <p className="text-sm text-felt">Inscrito. Puedes cerrar o inscribir otro.</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
