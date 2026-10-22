"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import type { Category, Inscription, Player, Tournament } from "@prisma/client";
import {
  assignInscribedPlayerDocument,
  checkInAll,
  removeInscription,
  toggleCheckIn,
  togglePaid,
  updateInscription,
} from "@/lib/actions/inscriptions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { InscribePlayerModal } from "@/components/InscribePlayerModal";
import { ReplacePlayerForm } from "@/components/ReplacePlayerForm";
import { formatCOP, placeLabel } from "@/lib/labels";
import { resolveTournamentPrizes } from "@/lib/prize-pool";
import { standingBadgeClass, type StandingInfo } from "@/lib/standing";

type PlayerView = Omit<Player, "photoData">;
type TournamentView = Omit<Tournament, "imageData">;
type InsRow = Inscription & { player: PlayerView; category: Category | null };

type Filter = "all" | "unpaid" | "unchecked";

function StatusToggle({
  checked,
  onToggle,
  onLabel,
  offLabel,
  onClass,
  boxOnClass = "border-live bg-live text-navy",
}: {
  checked: boolean;
  onToggle: () => Promise<unknown>;
  onLabel: string;
  offLabel: string;
  onClass: string;
  boxOnClass?: string;
}) {
  const [value, setValue] = useOptimistic(checked);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={value}
      disabled={pending}
      title={value ? onLabel : offLabel}
      onClick={() => {
        startTransition(async () => {
          setValue(!value);
          await onToggle();
        });
      }}
      className="inline-flex cursor-pointer items-center gap-2 text-sm disabled:opacity-60"
    >
      <span
        aria-hidden
        className={`grid h-4 w-4 place-items-center rounded-[3px] border text-[10px] leading-none ${
          value ? boxOnClass : "border-line bg-navy text-transparent"
        }`}
      >
        ✓
      </span>
      <span className={value ? onClass : "text-muted"}>{value ? onLabel : offLabel}</span>
    </button>
  );
}

export function InscriptionManager({
  tournament,
  inscriptions,
  categories,
  availablePlayers,
  hasGroups,
  groupedIds,
  lockedIds,
  standings,
  prizes = [],
}: {
  tournament: TournamentView;
  inscriptions: InsRow[];
  categories: Category[];
  availablePlayers: (PlayerView & { category: Category | null })[];
  hasGroups: boolean;
  groupedIds: string[];
  lockedIds: string[];
  standings: Record<string, StandingInfo>;
  prizes?: { place: number; amount: number; sharePercent: number | null }[];
}) {
  const defaultCategory =
    tournament.mix === "SINGLE" && tournament.singleCategoryId
      ? categories.find((c) => c.id === tournament.singleCategoryId)
      : categories[0];

  const [categoryId, setCategoryId] = useState(defaultCategory?.id ?? "");
  const selected = categories.find((c) => c.id === categoryId);
  const [distance, setDistance] = useState(String(selected?.distance ?? 12));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removingPending, setRemovingPending] = useState(false);
  const [inscribeOpen, setInscribeOpen] = useState(false);
  const [existPlayerId, setExistPlayerId] = useState(availablePlayers[0]?.id ?? "");
  const existPlayer = availablePlayers.find((p) => p.id === existPlayerId);
  const needCedulaForExist = Boolean(existPlayer && !existPlayer.documentId);
  const router = useRouter();

  const grouped = useMemo(() => new Set(groupedIds), [groupedIds]);
  const locked = useMemo(() => new Set(lockedIds), [lockedIds]);
  const benchInscriptions = useMemo(
    () => inscriptions.filter((row) => !grouped.has(row.id)),
    [inscriptions, grouped],
  );
  const replacing = inscriptions.find((row) => row.id === replacingId) ?? null;
  const removing = inscriptions.find((row) => row.id === removingId) ?? null;

  const checked = inscriptions.filter((i) => i.checkedIn).length;
  const paid = inscriptions.filter((i) => i.paid).length;
  const unpaidCount = inscriptions.length - paid;
  const fee = tournament.entryFee;
  const prizeSummary = useMemo(
    () =>
      resolveTournamentPrizes(
        {
          entryFee: tournament.entryFee,
          prizePoolPercent: tournament.prizePoolPercent,
          prizeShareMode: tournament.prizeShareMode,
        },
        prizes,
        inscriptions,
      ),
    [tournament.entryFee, tournament.prizePoolPercent, tournament.prizeShareMode, prizes, inscriptions],
  );
  const collected = fee != null ? prizeSummary.revenue.collected : null;
  const pendingAmount =
    fee != null ? prizeSummary.revenue.potentialIfAllPaid - prizeSummary.revenue.collected : null;
  const resolvedPrizes = prizeSummary.prizes;
  const prizeTotal = prizeSummary.prizeTotal;

  const categoryOptions = useMemo(
    () => categories.filter((c) => c.active || inscriptions.some((i) => i.categoryId === c.id)),
    [categories, inscriptions],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...inscriptions]
      .filter((row) => {
        if (filter === "unpaid" && row.paid) return false;
        if (filter === "unchecked" && row.checkedIn) return false;
        if (categoryFilter !== "all" && row.categoryId !== categoryFilter) return false;
        if (!q) return true;
        const hay = `${row.player.name} ${row.player.alias ?? ""} ${row.player.club ?? ""} ${row.category?.name ?? ""}`;
        return hay.toLowerCase().includes(q);
      })
      .sort((a, b) => a.player.name.localeCompare(b.player.name, "es"));
  }, [inscriptions, query, filter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const from = rows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, rows.length);

  useEffect(() => {
    setPage(1);
  }, [query, filter, categoryFilter, pageSize]);

  return (
    <div className="grid gap-6">
      {fee != null && (
        <div className="rounded-xl border border-line bg-paper px-4 py-3 text-sm">
          <h3 className="font-semibold text-cream">Recaudo e inscripciones</h3>
          <dl className="mt-2 grid gap-1 sm:grid-cols-2">
            <div>
              <dt className="text-muted">Recaudado (pagadas)</dt>
              <dd className="text-lg font-semibold text-cream">
                {formatCOP(prizeSummary.revenue.collected)}
                <span className="ml-2 text-sm font-normal text-muted">
                  {paid}/{inscriptions.length} inscripciones
                </span>
              </dd>
            </div>
            {unpaidCount > 0 && (
              <div>
                <dt className="text-muted">Pendiente de cobro</dt>
                <dd className="font-medium text-warning">
                  {formatCOP(pendingAmount ?? 0)} ({unpaidCount} sin marcar pagadas)
                </dd>
              </div>
            )}
            {prizes.length > 0 && prizeSummary.mode === "PERCENT" && (
              <>
                <div>
                  <dt className="text-muted">Bolsa de premios ({prizeSummary.poolPercent} %)</dt>
                  <dd className="font-semibold text-felt">{formatCOP(prizeSummary.prizePool)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Reparto configurado</dt>
                  <dd className="text-muted">
                    {resolvedPrizes.map((row, i) => (
                      <span key={row.place}>
                        {i > 0 ? " · " : ""}
                        {placeLabel(row.place)} {row.sharePercent ?? 0}% ({formatCOP(row.amount)})
                      </span>
                    ))}
                  </dd>
                </div>
              </>
            )}
            {prizes.length > 0 && prizeSummary.mode === "FIXED" && prizeTotal > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-muted">Premios (montos fijos)</dt>
                <dd className="text-muted">
                  Bolsa total {formatCOP(prizeTotal)} —{" "}
                  {resolvedPrizes.map((row, i) => (
                    <span key={row.place}>
                      {i > 0 ? " · " : ""}
                      {placeLabel(row.place)} {formatCOP(row.amount)}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {inscriptions.length} inscritos · {paid} pagaron
          {collected != null && fee ? ` (${formatCOP(collected)})` : ""}
          {pendingAmount != null && fee && unpaidCount > 0
            ? ` · faltan ${unpaidCount} (${formatCOP(pendingAmount)})`
            : ""}
          {fee === 0 ? " · inscripción sin costo" : ""}
          {" · "}
          {checked} en check-in
          {prizeTotal > 0 ? ` · premios ${formatCOP(prizeTotal)}` : ""}
          {hasGroups ? " · grupos ya armados" : ""}
        </p>
        <form
          action={async () => {
            await checkInAll(tournament.id);
          }}
        >
          <button className="btn btn-ghost" type="submit">
            Chequear a todos
          </button>
        </form>
      </div>

      {hasGroups && (
        <p className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-muted">
          Los grupos ya están en juego. Los nuevos inscritos van a Grupos (sin grupo) para ubicarlos;
          si alguien no llega, pulsa <strong>Sustituir</strong> en su
          fila: quien entre ocupa el mismo puesto y no se vuelve a sortear.
        </p>
      )}

      {replacing && grouped.has(replacing.id) && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Sustituir a {replacing.player.name}</h2>
          <ReplacePlayerForm
            key={replacing.id}
            inscriptionId={replacing.id}
            outgoingName={replacing.player.name}
            defaultCategoryId={replacing.categoryId ?? categoryId}
            defaultDistance={replacing.distance}
            defaultPaid={replacing.paid}
            categories={categories}
            availablePlayers={availablePlayers}
            benchInscriptions={benchInscriptions.filter((row) => row.id !== replacing.id)}
            onDone={() => setReplacingId(null)}
            onCancel={() => setReplacingId(null)}
          />
        </div>
      )}

      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b border-line bg-navy/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
        <button
          type="button"
          className="btn btn-primary shrink-0"
          onClick={() => setInscribeOpen(true)}
        >
          Inscribir
        </button>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar nombre, alias o club"
          className="min-w-[10rem] flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm"
        />
        {(
          [
            ["all", "Todos"],
            ["unpaid", `Sin pagar (${inscriptions.length - paid})`],
            ["unchecked", `Sin llegada (${inscriptions.length - checked})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === id ? "bg-p1 text-white" : "border border-line bg-paper text-muted"
            }`}
          >
            {label}
          </button>
        ))}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-line bg-paper px-3 py-2 text-sm"
        >
          <option value="all">Todas las categorías</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
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
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">
            {inscriptions.length === 0
              ? "Todavía no hay inscritos."
              : "Ningún inscrito coincide con la búsqueda."}
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th>Jugador</th>
                <th>Estado</th>
                <th>Categoría</th>
                <th>Dist.</th>
                <th>Pagó</th>
                <th>Check-in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, index) => (
                <tr key={row.id}>
                  <td className="tabular-nums text-muted">{from + index}</td>
                  <td>
                    <p className="font-medium">{row.player.name}</p>
                    <p className="text-xs text-muted">
                      {[row.player.alias, row.player.club].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {!row.player.documentId && (
                      <form
                        className="mt-2 flex flex-wrap items-end gap-2"
                        action={async (formData) => {
                          await assignInscribedPlayerDocument(formData);
                        }}
                      >
                        <input type="hidden" name="inscriptionId" value={row.id} />
                        <div className="field min-w-[10rem] flex-1">
                          <label className="text-xs" htmlFor={`doc-${row.id}`}>
                            Sin cédula — no puede entrar aún
                          </label>
                          <input
                            id={`doc-${row.id}`}
                            name="documentId"
                            inputMode="numeric"
                            placeholder="Cédula"
                            required
                            className="text-sm"
                          />
                        </div>
                        <button type="submit" className="btn btn-ghost text-sm">
                          Guardar cédula
                        </button>
                      </form>
                    )}
                  </td>
                  <td>
                    <span className={standingBadgeClass(standings[row.id]?.kind ?? "waiting")}>
                      {standings[row.id]?.label ?? "En espera"}
                    </span>
                  </td>
                  <td>
                    <form
                      action={async (formData) => {
                        await updateInscription(formData);
                      }}
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="distance" value={row.distance} />
                      <select
                        name="categoryId"
                        defaultValue={row.categoryId ?? ""}
                        className="max-w-[9rem] rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink"
                        onChange={(e) => {
                          const form = e.currentTarget.form;
                          const cat = categoryOptions.find((c) => c.id === e.target.value);
                          const dist = form?.elements.namedItem("distance") as HTMLInputElement | null;
                          if (cat && dist) dist.value = String(cat.distance);
                          form?.requestSubmit();
                        }}
                      >
                        <option value="">—</option>
                        {categoryOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </form>
                  </td>
                  <td>
                    <form
                      action={async (formData) => {
                        await updateInscription(formData);
                      }}
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="categoryId" value={row.categoryId ?? ""} />
                      <input
                        name="distance"
                        type="number"
                        min={1}
                        max={80}
                        defaultValue={row.distance}
                        className="w-16 rounded-md border border-line bg-surface px-2 py-1 text-sm tabular-nums text-ink"
                        onBlur={(e) => {
                          if (Number(e.currentTarget.value) !== row.distance) {
                            e.currentTarget.form?.requestSubmit();
                          }
                        }}
                      />
                    </form>
                  </td>
                  <td>
                    <StatusToggle
                      checked={row.paid}
                      onToggle={() => togglePaid(row.id)}
                      onLabel="Pagó"
                      offLabel="Sin pago"
                      onClass="text-live"
                    />
                  </td>
                  <td>
                    <StatusToggle
                      checked={row.checkedIn}
                      onToggle={() => toggleCheckIn(row.id)}
                      onLabel="Llegó"
                      offLabel="Pendiente"
                      onClass="text-p1"
                      boxOnClass="border-p1 bg-p1 text-navy"
                    />
                  </td>
                  <td className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {hasGroups && grouped.has(row.id) && (
                        <button
                          type="button"
                          className="text-xs text-p1"
                          disabled={locked.has(row.id)}
                          title={
                            locked.has(row.id)
                              ? "Ya tiene un partido en mesa o cerrado"
                              : "Cambiar por otra persona sin regenerar grupos"
                          }
                          onClick={() => setReplacingId(row.id)}
                        >
                          Sustituir
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-xs text-danger"
                        onClick={() => setRemovingId(row.id)}
                      >
                        Quitar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted">
            Mostrando {from}–{to} de {rows.length}
            {rows.length !== inscriptions.length ? ` (filtro de ${inscriptions.length})` : ""}
          </p>
          {totalPages > 1 && (
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              className="btn btn-ghost px-3 py-1 text-sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
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
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </button>
          </div>
          )}
        </div>
      )}

      <InscribePlayerModal
        open={inscribeOpen}
        onClose={() => setInscribeOpen(false)}
        onSuccess={() => router.refresh()}
        tournament={tournament}
        categories={categories}
        categoryOptions={categoryOptions}
        availablePlayers={availablePlayers}
        categoryId={categoryId}
        setCategoryId={setCategoryId}
        distance={distance}
        setDistance={setDistance}
        existPlayerId={existPlayerId}
        setExistPlayerId={setExistPlayerId}
        needCedulaForExist={needCedulaForExist}
        selectedCategoryName={selected?.name ?? ""}
      />
      <ConfirmDialog
        open={Boolean(removing)}
        title="Quitar inscrito"
        message={
          removing
            ? `¿Quitar a ${removing.player.name} de este torneo?`
            : ""
        }
        confirmLabel="Quitar"
        danger
        pending={removingPending}
        onCancel={() => setRemovingId(null)}
        onConfirm={async () => {
          if (!removing) return;
          setRemovingPending(true);
          const form = new FormData();
          form.set("id", removing.id);
          await removeInscription(form);
          setRemovingPending(false);
          setRemovingId(null);
        }}
      />
    </div>
  );
}
