"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import type { Category, Inscription, Match, Player, Table } from "@prisma/client";
import {
  assignMatchToTable,
  assignNextMatches,
  releaseTable,
  reopenMatch,
} from "@/lib/actions/matches";
import { ManualResultForm, type ManualResultMatch } from "@/components/ManualResultForm";
import { ResendTableAlertsButton } from "@/components/ResendTableAlertsButton";

type Side = (Inscription & { player: Omit<Player, "photoData">; category: Category | null }) | null;

export type MatchRow = Match & {
  sideA: Side;
  sideB: Side;
  table: Table | null;
};

function label(match: MatchRow) {
  const prefix = match.phase === "KO" ? "Eliminación · " : "";
  const a = match.sideA?.player.name ?? "Por definir";
  const b = match.sideB?.player.name ?? "Por definir";
  return `${prefix}${a} (${match.distanceA}) vs ${b} (${match.distanceB})`;
}

function fold(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchHasPlayer(match: MatchRow, query: string) {
  if (!query) return true;
  const hay = [
    match.sideA?.player.name,
    match.sideA?.player.alias,
    match.sideB?.player.name,
    match.sideB?.player.alias,
  ]
    .map(fold)
    .join(" ");
  return hay.includes(query);
}

function scoreLine(match: MatchRow) {
  if (match.status === "WALKOVER") return "W.O.";
  if (match.caromsA == null || match.caromsB == null) return "Sin marcador";
  const tm =
    match.highRunA != null || match.highRunB != null
      ? ` · TM ${match.highRunA ?? "—"}/${match.highRunB ?? "—"}`
      : "";
  return `${match.caromsA}–${match.caromsB}${match.innings != null ? ` · ${match.innings} ent.` : ""}${tm}`;
}

function AssignMatchToTableForm({
  matchId,
  freeTables,
  playersBusy,
  lockedTable,
}: {
  matchId: string;
  freeTables: Table[];
  playersBusy: boolean;
  lockedTable?: { id: string; number: number } | null;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; ok?: boolean } | null, formData: FormData) => {
      const result = await assignMatchToTable(formData);
      return result ?? null;
    },
    null,
  );
  const lockedId = lockedTable?.id;
  const allowedTables = useMemo(
    () => (lockedId ? freeTables.filter((table) => table.id === lockedId) : freeTables),
    [freeTables, lockedId],
  );
  const [tableId, setTableId] = useState(allowedTables[0]?.id ?? "");

  useEffect(() => {
    if (!allowedTables.some((t) => t.id === tableId)) {
      setTableId(allowedTables[0]?.id ?? "");
    }
  }, [allowedTables, tableId]);

  const canAssign = allowedTables.length > 0 && !playersBusy && Boolean(tableId);

  if (playersBusy) {
    return <p className="text-sm text-muted">Un jugador de este cruce ya está en otra mesa.</p>;
  }
  if (lockedTable && allowedTables.length === 0) {
    return (
      <p className="text-sm text-muted">
        Este grupo juega en la mesa {lockedTable.number}. Está ocupada o no disponible.
      </p>
    );
  }
  if (freeTables.length === 0) {
    return <p className="text-sm text-muted">No hay mesas libres. Libera una mesa o espera a que termine un partido.</p>;
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-2 sm:w-auto">
      <div className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="matchId" value={matchId} />
        <select
          name="tableId"
          className="rounded-lg border border-line bg-paper px-2 py-2 text-sm"
          required
          value={tableId}
          onChange={(e) => setTableId(e.target.value)}
        >
          {allowedTables.map((table) => (
            <option key={table.id} value={table.id}>
              Mesa {table.number}
            </option>
          ))}
        </select>
        <button className="btn btn-ghost" type="submit" disabled={pending || !canAssign}>
          {pending ? "Asignando…" : "Poner en mesa"}
        </button>
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}

function toManualMatch(match: MatchRow, requireInnings: boolean): ManualResultMatch | null {
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

export function CommandCenter({
  tournamentId,
  tables,
  live,
  queued,
  finished,
  requireInnings,
  groupTables = [],
}: {
  tournamentId: string;
  tables: Table[];
  live: MatchRow[];
  queued: MatchRow[];
  finished: MatchRow[];
  requireInnings: boolean;
  groupTables?: { groupId: string; tableId: string; tableNumber: number }[];
}) {
  const liveByTable = new Map(
    live.flatMap((m): [string, MatchRow][] => (m.tableId ? [[m.tableId, m]] : [])),
  );
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [queueQuery, setQueueQuery] = useState("");
  const busyPlayers = new Set(live.flatMap((match) => [match.sideAId, match.sideBId].filter(Boolean)));
  const freeTables = useMemo(
    () => tables.filter((table) => !liveByTable.has(table.id)),
    [tables, liveByTable],
  );
  const canAssign =
    freeTables.length > 0 &&
    queued.some((match) => [match.sideAId, match.sideBId].every((id) => id && !busyPlayers.has(id)));
  const foldedQuery = fold(queueQuery.trim());
  const visibleQueue = useMemo(
    () => queued.filter((match) => matchHasPlayer(match, foldedQuery)),
    [queued, foldedQuery],
  );

  return (
    <div className="grid gap-8">
      <form
        action={async () => {
          setAssigning(true);
          try {
            await assignNextMatches(tournamentId);
          } finally {
            setAssigning(false);
          }
        }}
      >
        <button className="btn btn-primary" type="submit" disabled={!canAssign || assigning}>
          {assigning ? "Asignando…" : "Asignar siguientes a mesas libres"}
        </button>
      </form>
      {!canAssign && (
        <p className="text-sm text-muted">
          {queued.length === 0
            ? "No hay partidos pendientes. Asignar mesas queda deshabilitado."
            : "No hay una mesa libre con dos jugadores que no estén ya jugando."}
        </p>
      )}
      <p className="text-sm text-muted">
        El marcador en vivo sirve si anotas carambola a carambola. Si el partido ya se jugó, usa{" "}
        <strong>Cargar resultado</strong>.
      </p>

      <section>
        <h2 className="font-serif mb-3 text-2xl">Mesas</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {tables.map((table) => {
            const match = liveByTable.get(table.id);
            const manual = match ? toManualMatch(match, requireInnings) : null;
            return (
              <li key={table.id} className="card">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-semibold">Mesa {table.number}</p>
                  <span className="text-sm text-muted">{match ? "En juego" : "Libre"}</span>
                </div>
                {match ? (
                  <>
                    <p className="text-sm">{label(match)}</p>
                    <p className="mt-1 text-sm text-muted">{scoreLine(match)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/app/torneos/${tournamentId}/mesas/${table.number}`}
                        className="btn btn-primary"
                      >
                        Marcador
                      </Link>
                      {manual && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setScoringId((id) => (id === match.id ? null : match.id))}
                        >
                          Cargar resultado
                        </button>
                      )}
                      <ResendTableAlertsButton matchId={match.id} />
                      <form
                        action={async (formData) => {
                          await releaseTable(formData);
                        }}
                      >
                        <input type="hidden" name="matchId" value={match.id} />
                        <button className="btn btn-ghost" type="submit">
                          Liberar
                        </button>
                      </form>
                    </div>
                    {scoringId === match.id && manual && (
                      <div className="mt-3">
                        <ManualResultForm match={manual} onCancel={() => setScoringId(null)} />
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted">Sin partido.</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-serif text-2xl">
            Cola ({foldedQuery ? `${visibleQueue.length} de ${queued.length}` : queued.length})
          </h2>
          {queued.length > 0 && (
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Buscar deportista</span>
              <input
                type="search"
                value={queueQuery}
                onChange={(event) => setQueueQuery(event.target.value)}
                placeholder="Nombre o alias"
                className="w-64 max-w-full rounded-lg border border-line bg-paper px-3 py-2"
              />
            </label>
          )}
        </div>
        {queued.length === 0 ? (
          <p className="text-sm text-muted">No hay partidos pendientes de mesa.</p>
        ) : visibleQueue.length === 0 ? (
          <p className="text-sm text-muted">Ningún partido de la cola coincide con ese nombre.</p>
        ) : (
          <ul className="grid gap-3">
            {visibleQueue.map((match) => {
              const manual = toManualMatch(match, requireInnings);
              return (
                <li key={match.id} className="card grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm">{label(match)}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <AssignMatchToTableForm
                        matchId={match.id}
                        freeTables={freeTables}
                        playersBusy={[match.sideAId, match.sideBId].some(
                          (id) => id && busyPlayers.has(id),
                        )}
                        lockedTable={
                          match.phase === "GROUP" && match.groupId
                            ? (() => {
                                const row = groupTables.find((entry) => entry.groupId === match.groupId);
                                return row ? { id: row.tableId, number: row.tableNumber } : null;
                              })()
                            : null
                        }
                      />
                      {manual && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setScoringId((id) => (id === match.id ? null : match.id))}
                        >
                          Cargar resultado
                        </button>
                      )}
                    </div>
                  </div>
                  {scoringId === match.id && manual && (
                    <ManualResultForm match={manual} onCancel={() => setScoringId(null)} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {finished.length > 0 && (
        <section>
          <h2 className="font-serif mb-3 text-2xl">Cerrados</h2>
          <ul className="grid gap-2 text-sm">
            {finished.map((match) => (
              <li key={match.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
                <span>{label(match)}</span>
                <span className="flex items-center gap-3">
                  <span className="text-muted">{scoreLine(match)}</span>
                  <form
                    action={async (formData) => {
                      await reopenMatch(formData);
                    }}
                  >
                    <input type="hidden" name="matchId" value={match.id} />
                    <button className="text-sm text-felt" type="submit">
                      Reabrir
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
