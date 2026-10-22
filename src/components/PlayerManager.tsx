"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Category } from "@prisma/client";
import { createPlayer, updatePlayer } from "@/lib/actions/players";
import { DataProcessingConsent } from "@/components/DataProcessingConsent";
import { PhotoFileField } from "@/components/PhotoFileField";
import { formatCareerAverage } from "@/lib/player-label";

export type PlayerDirectoryRow = {
  id: string;
  userId: string;
  code: string | null;
  name: string;
  alias: string | null;
  documentId: string | null;
  email: string | null;
  phone: string | null;
  club: string | null;
  photoSrc: string | null;
  categoryId: string | null;
  category: { id: string; name: string; distance: number } | null;
  championships: number;
  careerAverage: number | null;
  tournamentsPlayed: number;
  handicap: number | null;
  canEdit: boolean;
};

export function PlayerManager({
  players,
  categories,
}: {
  players: PlayerDirectoryRow[];
  categories: Category[];
}) {
  const [q, setQ] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      createPlayer(formData),
    null,
  );
  const [editState, editAction, editPending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, formData: FormData) =>
      updatePlayer(formData),
    null,
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return players;
    return players.filter((p) =>
      [p.name, p.alias, p.club, p.phone, p.category?.name, p.code, p.documentId]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [players, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const from = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, filtered.length);
  const editing = players.find((p) => p.id === editingId) ?? null;

  useEffect(() => {
    setPage(1);
  }, [q, pageSize]);

  useEffect(() => {
    if (editState && "ok" in editState && editState.ok) setEditingId(null);
  }, [editState]);

  useEffect(() => {
    if (state && "ok" in state && state.ok) setCreateOpen(false);
  }, [state]);

  useEffect(() => {
    const modalOpen = Boolean(editingId) || createOpen;
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditingId(null);
        setCreateOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [editingId, createOpen]);

  const openCreate = () => {
    setEditingId(null);
    setCreateOpen(true);
  };

  const openEdit = (id: string) => {
    setCreateOpen(false);
    setEditingId(id);
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          className="w-full min-w-0 rounded-lg border border-line bg-paper px-3 py-2 sm:min-w-[14rem] sm:flex-1"
          placeholder="Buscar jugador…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="rounded-lg border border-line bg-paper px-3 py-2 text-sm"
          aria-label="Filas por página"
        >
          <option value={20}>20 por página</option>
          <option value={50}>50 por página</option>
          <option value={100}>100 por página</option>
        </select>
        <button type="button" className="btn btn-primary shrink-0" onClick={openCreate}>
          Nuevo jugador
        </button>
      </div>

      <div className="grid gap-2 sm:hidden">
        {pageRows.length === 0 ? (
          <p className="rounded-2xl border border-line bg-paper px-4 py-8 text-sm text-muted">
            {players.length === 0
              ? "Todavía no hay deportistas registrados."
              : "Nadie coincide con la búsqueda."}
          </p>
        ) : (
          pageRows.map((p) => (
            <article key={p.id} className="rounded-2xl border border-line bg-paper px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/app/jugadores/${p.id}`} className="font-medium text-p1">
                    {p.name}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    {p.code || "Sin código"}
                    {p.club ? ` · ${p.club}` : ""}
                    {p.alias ? ` · ${p.alias}` : ""}
                  </p>
                  <p className="text-xs text-muted">
                    {p.championships === 1 ? "1 título" : `${p.championships} títulos`} · prom.{" "}
                    {formatCareerAverage(p.careerAverage)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                  <Link href={`/app/jugadores/${p.id}`} className="text-p1">
                    Historial
                  </Link>
                  {p.canEdit ? (
                    <button type="button" className="text-p1" onClick={() => openEdit(p.id)}>
                      Editar
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="hidden max-w-full overflow-x-auto rounded-2xl border border-line bg-paper sm:block">
        {pageRows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">
            {players.length === 0
              ? "Todavía no hay deportistas registrados."
              : "Nadie coincide con la búsqueda."}
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Club</th>
                <th>Títulos</th>
                <th>Prom. general</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-sm">{p.code || "—"}</td>
                  <td>
                    <Link href={`/app/jugadores/${p.id}`} className="inline-flex items-center gap-2 font-medium text-p1">
                      <span className="initials" aria-hidden>
                        {p.name
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")
                          .toUpperCase()}
                      </span>
                      {p.name}
                    </Link>
                    {p.alias ? <div className="text-xs text-muted">{p.alias}</div> : null}
                  </td>
                  <td className="text-muted">{p.club || "—"}</td>
                  <td>{p.championships}</td>
                  <td>{formatCareerAverage(p.careerAverage)}</td>
                  <td className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link href={`/app/jugadores/${p.id}`} className="text-xs text-p1">
                        Historial
                      </Link>
                      {p.canEdit ? (
                        <button type="button" className="text-xs text-p1" onClick={() => openEdit(p.id)}>
                          Editar
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted">
            Mostrando {from}–{to} de {filtered.length}
            {filtered.length !== players.length ? ` (filtro de ${players.length})` : ""}
          </p>
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                className="btn btn-ghost px-3 py-1 text-sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((n) => Math.max(1, n - 1))}
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`min-w-8 rounded-lg px-2 py-1 text-sm ${
                    n === currentPage ? "bg-p1 text-white" : "border border-line bg-paper text-muted"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className="btn btn-ghost px-3 py-1 text-sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-navy/75"
            aria-label="Cerrar edición"
            onClick={() => setEditingId(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-player-title"
            className="relative max-h-[100dvh] w-full min-w-0 max-w-2xl overflow-x-hidden overflow-y-auto rounded-t-2xl border border-line bg-paper p-4 shadow-2xl sm:max-h-[min(90vh,720px)] sm:rounded-2xl sm:p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id="edit-player-title" className="font-serif text-xl">
                Editar jugador
              </h2>
              <button type="button" className="btn btn-ghost px-2 py-1 text-sm" onClick={() => setEditingId(null)}>
                Cerrar
              </button>
            </div>
            <p className="mb-4 text-sm text-muted">
              {editing.name}
              {editing.code ? ` · ${editing.code}` : ""}
            </p>
            <form action={editAction} className="grid min-w-0 gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={editing.id} />
              <div className="field sm:col-span-2">
                <label>Nombre</label>
                <input name="name" defaultValue={editing.name} required />
              </div>
              <div className="field">
                <label>Alias</label>
                <input name="alias" defaultValue={editing.alias ?? ""} />
              </div>
              <div className="field">
                <label>Celular</label>
                <input name="phone" defaultValue={editing.phone ?? ""} />
              </div>
              <div className="field">
                <label>Cédula</label>
                {editing.documentId ? (
                  <>
                    <input value={editing.documentId} disabled readOnly />
                    <p className="text-xs text-muted">La cédula no se cambia.</p>
                  </>
                ) : (
                  <input name="documentId" inputMode="numeric" />
                )}
              </div>
              <div className="field">
                <label>Email (opcional)</label>
                <input name="email" type="email" defaultValue={editing.email ?? ""} />
              </div>
              <div className="field">
                <label>Club</label>
                <input name="club" defaultValue={editing.club ?? ""} />
              </div>
              <div className="sm:col-span-2">
                <PhotoFileField key={editing.id} existingSrc={editing.photoSrc} label="Foto" />
              </div>
              <div className="field sm:col-span-2">
                <label>Categoría</label>
                <select name="categoryId" defaultValue={editing.categoryId ?? ""}>
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.distance})
                    </option>
                  ))}
                </select>
              </div>
              {editState && "error" in editState && editState.error && (
                <p className="text-sm text-danger sm:col-span-2">{editState.error}</p>
              )}
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button className="btn btn-primary" type="submit" disabled={editPending}>
                  {editPending ? "Guardando…" : "Guardar cambios"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditingId(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-navy/75"
            aria-label="Cerrar"
            onClick={() => setCreateOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-player-title"
            className="relative max-h-[100dvh] w-full min-w-0 max-w-2xl overflow-x-hidden overflow-y-auto rounded-t-2xl border border-line bg-paper p-4 shadow-2xl sm:max-h-[min(90vh,720px)] sm:rounded-2xl sm:p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id="new-player-title" className="font-serif text-xl">
                Nuevo jugador
              </h2>
              <button type="button" className="btn btn-ghost px-2 py-1 text-sm" onClick={() => setCreateOpen(false)}>
                Cerrar
              </button>
            </div>
            <p className="mb-4 text-sm text-muted">
              Entra al listado global. Si la cédula ya existe, usa esa ficha al inscribir en un torneo.
            </p>
            <form action={formAction} className="grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="field sm:col-span-2">
                <label htmlFor="new-name">Nombre</label>
                <input id="new-name" name="name" required autoFocus />
              </div>
              <div className="field">
                <label htmlFor="new-alias">Alias</label>
                <input id="new-alias" name="alias" />
              </div>
              <div className="field">
                <label htmlFor="new-phone">Celular</label>
                <input id="new-phone" name="phone" />
              </div>
              <div className="field sm:col-span-2">
                <label htmlFor="new-documentId">Cédula</label>
                <input id="new-documentId" name="documentId" inputMode="numeric" placeholder="Opcional" />
                <p className="text-xs text-muted">
                  Si la pones, el jugador entra en la app con esa cédula (usuario y contraseña).
                </p>
              </div>
              <div className="field">
                <label htmlFor="new-email">Email (opcional)</label>
                <input id="new-email" name="email" type="email" autoComplete="email" />
              </div>
              <div className="field">
                <label htmlFor="new-club">Club</label>
                <input id="new-club" name="club" />
              </div>
              <div className="sm:col-span-2">
                <PhotoFileField label="Foto" />
              </div>
              <div className="field sm:col-span-2">
                <label htmlFor="new-categoryId">Categoría</label>
                <select id="new-categoryId" name="categoryId" defaultValue={categories[0]?.id ?? ""}>
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.distance})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <DataProcessingConsent variant="organizer" />
              </div>
              {state && "error" in state && state.error && (
                <p className="text-sm text-danger sm:col-span-2">{state.error}</p>
              )}
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button className="btn btn-primary" type="submit" disabled={pending}>
                  {pending ? "Guardando…" : "Añadir a la agenda"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
