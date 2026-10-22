"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { ManualResultForm, type ManualResultMatch } from "@/components/ManualResultForm";
import {
  clearPlayInMatches,
  createPlayInMatchesCustom,
} from "@/lib/actions/play-in";
import { setRepescaOptIn } from "@/lib/actions/repesca";
import type { PlayInCandidate, QualifiedForPlayIn } from "@/lib/knockout-entry";
import { formatCOP } from "@/lib/labels";
import {
  PLAY_IN_KIND_LABEL,
  playInAssignedInscriptionIds,
  suggestRepescaMatchRows,
  type PlayInKind,
} from "@/lib/play-in-setup";

type RosterRow = {
  id: string;
  name: string;
  groupName: string;
  repescaOptIn: boolean | null;
  repescaFeePaid: boolean;
  bench?: boolean;
  seed?: number | null;
};

export function RepescaSetup({
  tournamentId,
  bracketSize,
  extraNeeded,
  repescaFee,
  roster,
  repescaPool,
  qualifiedPool,
  secondQualifiedPool = [],
  playInMatches,
}: {
  tournamentId: string;
  bracketSize: number;
  extraNeeded: number;
  repescaFee: number | null;
  roster: RosterRow[];
  repescaPool: PlayInCandidate[];
  qualifiedPool: QualifiedForPlayIn[];
  secondQualifiedPool?: QualifiedForPlayIn[];
  playInMatches: (ManualResultMatch & {
    status: string;
    playInKind?: string | null;
    sideAId?: string;
    sideBId?: string;
  })[];
}) {
  const [customState, customAction, customPending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, fd: FormData) =>
      createPlayInMatchesCustom(fd),
    null,
  );
  const [clearState, clearAction, clearPending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, fd: FormData) => clearPlayInMatches(fd),
    null,
  );
  const assignedPlayInIds = useMemo(
    () => playInAssignedInscriptionIds(playInMatches),
    [playInMatches],
  );
  const repescaAvailable = useMemo(
    () => repescaPool.filter((c) => !assignedPlayInIds.has(c.id)),
    [repescaPool, assignedPlayInIds],
  );
  const repescaWithoutSlot = repescaAvailable.filter((c) => !c.koEligible);
  const repescaWithSlot = repescaAvailable.filter((c) => c.koEligible);
  const openPlayIn = playInMatches.some(
    (m) => m.status === "SCHEDULED" || m.status === "LIVE",
  );
  const showCreateForm = extraNeeded > 0 && !openPlayIn;
  const maxVacantByRepesca = Math.floor(repescaWithoutSlot.length / 2);

  const [pairs, setPairs] = useState<{ sideA: string; sideB: string; kind: PlayInKind }[]>(() =>
    suggestRepescaMatchRows(extraNeeded, repescaPool.length).map((row) => ({
      sideA: "",
      sideB: "",
      kind: row.kind,
    })),
  );

  useEffect(() => {
    setPairs(
      suggestRepescaMatchRows(extraNeeded, repescaPool.length).map((row) => ({
        sideA: "",
        sideB: "",
        kind: row.kind,
      })),
    );
  }, [extraNeeded, repescaPool.length]);

  const canReconfigure =
    playInMatches.length > 0 &&
    !playInMatches.some((m) => m.status === "CLOSED" || m.status === "WALKOVER");

  const optInCount = roster.filter((r) => r.repescaOptIn === true).length;
  const unpaidCount = roster.filter(
    (r) => r.repescaOptIn === true && (repescaFee ?? 0) > 0 && !r.repescaFeePaid,
  ).length;
  const assignedCount = assignedPlayInIds.size;

  function excludeDraftPicks(
    pairIndex: number,
    side: "A" | "B",
    ids: Set<string>,
  ) {
    pairs.forEach((p, i) => {
      if (p.sideA && !(i === pairIndex && side === "A")) ids.add(p.sideA);
      if (p.sideB && !(i === pairIndex && side === "B")) ids.add(p.sideB);
    });
  }

  function resolveName(id: string) {
    if (!id) return "";
    return (
      repescaPool.find((c) => c.id === id)?.name ??
      secondQualifiedPool.find((c) => c.id === id)?.name ??
      qualifiedPool.find((c) => c.id === id)?.name ??
      ""
    );
  }

  return (
    <div className="grid gap-6 border-t border-line pt-4">
      <section>
        <h3 className="font-serif text-lg">1. ¿Quién entra de reencauche?</h3>
        <p className="mt-1 text-sm text-muted">
          Marca <strong className="text-cream">Sí</strong> a quien{" "}
          <strong className="text-cream">no clasificó</strong> en su grupo y a inscritos{" "}
          <strong className="text-cream">sin grupo</strong>
          {repescaFee != null && repescaFee > 0
            ? ` (cobro extra ${formatCOP(repescaFee)})`
            : ""}
          . Van al final de la lista de ajuste. Inscribe nuevos en{" "}
          <Link href={`/app/torneos/${tournamentId}/inscritos`} className="text-p1">
            Inscritos
          </Link>{" "}
          — aparecen arriba en «sin grupo» o aquí abajo.
        </p>
        <ul className="mt-3 grid gap-2">
          {roster.map((row) => (
            <RepescaOptInRow
              key={row.id}
              row={row}
              repescaFee={repescaFee}
              inPlayInMatch={assignedPlayInIds.has(row.id)}
            />
          ))}
        </ul>
        {roster.length === 0 && (
          <p className="mt-2 text-sm text-muted">
            No hay eliminados para reencauche (revisa que los grupos estén cerrados).
          </p>
        )}
        <p className="mt-3 text-sm text-gold">
          Confirmados en reencauche: <strong>{optInCount}</strong>
          {unpaidCount > 0 ? (
            <>
              {" "}
              ({unpaidCount} sin marcar pago de la cuota)
            </>
          ) : null}
          {extraNeeded > 0 ? (
            <>
              . Faltan <strong>{extraNeeded}</strong> plaza{extraNeeded === 1 ? "" : "s"} en el
              cuadro: hacen falta <strong>{extraNeeded * 2}</strong> jugadores sin plaza en duelos
              repesca vs repesca
              {repescaWithoutSlot.length < extraNeeded * 2 ? (
                <>
                  {" "}
                  (sin plaza en el cuadro: <strong>{repescaWithoutSlot.length}</strong>
                  {repescaWithSlot.length > 0 ? (
                    <>
                      ; <strong>{repescaWithSlot.length}</strong> confirmados ya tienen plaza
                    </>
                  ) : null}
                  {maxVacantByRepesca > 0
                    ? ` → hasta ${maxVacantByRepesca} duelo${maxVacantByRepesca === 1 ? "" : "s"} repesca/repesca`
                    : ""}
                  . Vuelve a marcar «Sí repesca» en eliminados).
                </>
              ) : (
                "."
              )}
            </>
          ) : (
            ". Todas las plazas del cuadro están cubiertas."
          )}
        </p>
      </section>

      {playInMatches.length > 0 && (
        <section className="grid gap-4">
          <h3 className="font-serif text-lg">
            Partidos de ajuste
            {extraNeeded > 0 && !openPlayIn ? (
              <span className="ml-2 text-sm font-normal text-gold">
                (aún faltan {extraNeeded} plaza{extraNeeded === 1 ? "" : "s"})
              </span>
            ) : null}
          </h3>
          {playInMatches.map((m) => {
            const kind =
              m.playInKind && m.playInKind in PLAY_IN_KIND_LABEL
                ? PLAY_IN_KIND_LABEL[m.playInKind as PlayInKind]
                : null;
            return (
            <div key={m.id} className="rounded-lg border border-line p-3">
              <p className="mb-2 text-sm font-medium text-cream">
                {m.nameA} vs {m.nameB}
                {kind ? <span className="text-muted"> · {kind}</span> : null}
                {m.status === "CLOSED" || m.status === "WALKOVER" ? (
                  <span className="text-muted"> · cerrado</span>
                ) : null}
              </p>
              {(m.status === "SCHEDULED" || m.status === "LIVE") && (
                <ManualResultForm match={m} />
              )}
            </div>
          );
          })}
        </section>
      )}

      {canReconfigure && (
        <form action={clearAction}>
          <input type="hidden" name="tournamentId" value={tournamentId} />
          <button type="submit" className="text-sm text-p1" disabled={clearPending}>
            Cambiar partidos de ajuste (solo si no hay resultados)
          </button>
          {clearState && "error" in clearState && clearState.error && (
            <p className="text-sm text-danger">{clearState.error}</p>
          )}
        </form>
      )}

      {showCreateForm && (
        <section>
          <h3 className="font-serif text-lg">2. Armar partidos de ajuste</h3>
          <p className="mt-1 text-sm text-muted">
            {assignedCount > 0 ? (
              <>
                {assignedCount} jugador{assignedCount === 1 ? "" : "es"} ya está
                {assignedCount === 1 ? "" : "n"} en un partido de ajuste y no aparece otra vez en
                la lista.{" "}
              </>
            ) : null}
            Objetivo: llegar a <strong className="text-cream">{bracketSize}</strong> plazas. Quien ya
            clasificó por grupo no entra aquí. Solo{" "}
            <strong className="text-cream">repesca vs repesca</strong> para cupos vacíos (
            {extraNeeded} duelo{extraNeeded === 1 ? "" : "s"}).
          </p>
          <form action={customAction} className="mt-4 grid gap-4">
            <input type="hidden" name="tournamentId" value={tournamentId} />
            <input type="hidden" name="bracketSize" value={bracketSize} />
            <input type="hidden" name="playInMatchCount" value={pairs.length} />
            {pairs.map((pair, i) => {
              const excludeA = new Set(assignedPlayInIds);
              const excludeB = new Set(assignedPlayInIds);
              excludeDraftPicks(i, "A", excludeA);
              excludeDraftPicks(i, "B", excludeB);
              const labelA = resolveName(pair.sideA);
              const labelB = resolveName(pair.sideB);
              const kindLabel = PLAY_IN_KIND_LABEL[pair.kind];
              const matchupTitle =
                labelA && labelB
                  ? `${labelA} vs ${labelB}`
                  : pair.kind === "ELIM_VS_ELIM"
                    ? `Cupo vacío ${i + 1} de ${extraNeeded}`
                    : `Reto a 2.º · partido ${i + 1}`;
              return (
              <fieldset key={i} className="rounded-lg border border-line p-3">
                <legend className="px-1 text-sm font-semibold text-cream">
                  {matchupTitle}
                  <span className="ml-2 font-normal text-muted">· {kindLabel}</span>
                </legend>
                <div className="field mt-2 max-w-md">
                  <label htmlFor={`kind_${i}`}>Tipo de partido</label>
                  <select
                    id={`kind_${i}`}
                    name={`playInKind_${i}`}
                    value={pair.kind}
                    onChange={(e) =>
                      setPairs((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], kind: e.target.value as PlayInKind };
                        return next;
                      })
                    }
                  >
                    <option value="ELIM_VS_ELIM">{PLAY_IN_KIND_LABEL.ELIM_VS_ELIM}</option>
                  </select>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
                  <PlayerPick
                    label={labelA || "Elegir deportista (lado 1)"}
                    name={`sideA_${i}`}
                    id={`sideA_${i}`}
                    value={pair.sideA}
                    onChange={(v) =>
                      setPairs((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], sideA: v };
                        return next;
                      })
                    }
                    repescaPool={repescaWithoutSlot}
                    repescaPoolChallenge={repescaAvailable}
                    qualifiedPool={qualifiedPool}
                    secondQualifiedPool={secondQualifiedPool}
                    excludeIds={excludeA}
                    kind={pair.kind}
                  />
                  <span className="hidden pb-2 text-center text-sm text-muted sm:block">vs</span>
                  <PlayerPick
                    label={labelB || "Elegir deportista (lado 2)"}
                    name={`sideB_${i}`}
                    id={`sideB_${i}`}
                    value={pair.sideB}
                    onChange={(v) =>
                      setPairs((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], sideB: v };
                        return next;
                      })
                    }
                    repescaPool={repescaWithoutSlot}
                    repescaPoolChallenge={repescaAvailable}
                    qualifiedPool={qualifiedPool}
                    secondQualifiedPool={secondQualifiedPool}
                    excludeIds={excludeB}
                    kind={pair.kind}
                  />
                </div>
              </fieldset>
            );
            })}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary max-w-xs" disabled={customPending}>
                {customPending ? "Creando…" : "Crear partidos de ajuste"}
              </button>
            </div>
            {customState && "error" in customState && customState.error && (
              <p className="text-sm text-danger">{customState.error}</p>
            )}
          </form>
        </section>
      )}
    </div>
  );
}

function RepescaOptInRow({
  row,
  repescaFee,
  inPlayInMatch = false,
}: {
  row: RosterRow;
  repescaFee: number | null;
  inPlayInMatch?: boolean;
}) {
  const [state, formAction, pending] = useActionState(setRepescaOptIn, null);
  const router = useRouter();
  const feeRequired = repescaFee != null && repescaFee > 0;

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface/50 px-3 py-2 text-sm">
      <div>
        <span className="font-medium text-cream">{row.name}</span>
        <span className="text-muted">
          {" "}
          · {row.bench ? "Inscripción extra" : row.seed != null ? `${row.seed}.º` : "Eliminado"} ·{" "}
          {row.groupName}
        </span>
        {row.repescaOptIn === true && (
          <span className="ml-2 text-felt">Repesca sí</span>
        )}
        {row.repescaOptIn === false && (
          <span className="ml-2 text-muted">No repesca</span>
        )}
        {row.repescaOptIn === null && (
          <span className="ml-2 text-warning">Sin definir</span>
        )}
        {inPlayInMatch && (
          <span className="ml-2 text-muted">· En partido de ajuste</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <form action={formAction}>
          <input type="hidden" name="inscriptionId" value={row.id} />
          <input type="hidden" name="optIn" value="yes" />
          {feeRequired && <input type="hidden" name="feePaid" value="on" />}
          <button type="submit" className="btn btn-ghost px-2 py-1 text-xs" disabled={pending}>
            {pending ? "Guardando…" : "Sí repesca"}
          </button>
        </form>
        {feeRequired && row.repescaOptIn === true && (
          <form action={formAction} className="flex items-center gap-1 text-xs">
            <input type="hidden" name="inscriptionId" value={row.id} />
            <input type="hidden" name="optIn" value="yes" />
            <label className="flex items-center gap-1">
              <input type="checkbox" name="feePaid" defaultChecked={row.repescaFeePaid} />
              Pagó repesca
            </label>
            <button type="submit" className="text-p1" disabled={pending}>
              Guardar
            </button>
          </form>
        )}
        <form action={formAction}>
          <input type="hidden" name="inscriptionId" value={row.id} />
          <input type="hidden" name="optIn" value="no" />
          <button type="submit" className="btn btn-ghost px-2 py-1 text-xs" disabled={pending}>
            {pending ? "…" : "No"}
          </button>
        </form>
        {state?.error && <p className="w-full text-xs text-danger">{state.error}</p>}
      </div>
    </li>
  );
}

function PlayerPick({
  label,
  name,
  id,
  value,
  onChange,
  repescaPool,
  repescaPoolChallenge,
  qualifiedPool: _qualifiedPool,
  secondQualifiedPool: _secondQualifiedPool,
  excludeIds,
  kind,
}: {
  label: string;
  name: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  repescaPool: PlayInCandidate[];
  repescaPoolChallenge: PlayInCandidate[];
  qualifiedPool: QualifiedForPlayIn[];
  secondQualifiedPool: QualifiedForPlayIn[];
  excludeIds: Set<string>;
  kind: PlayInKind;
}) {
  const notExcluded = <T extends { id: string }>(list: T[]) =>
    list.filter((c) => !excludeIds.has(c.id) || c.id === value);

  const repescaList = notExcluded(
    kind === "ELIM_VS_ELIM"
      ? repescaPool.length > 0
        ? repescaPool
        : repescaPoolChallenge
      : repescaPoolChallenge,
  );
  const qualList: QualifiedForPlayIn[] = [];

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} name={name} required value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>
          Elegir deportista…
        </option>
        {repescaList.length > 0 && (
          <optgroup label="Inscritos en repesca">
            {repescaList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.groupName}
              </option>
            ))}
          </optgroup>
        )}
        {qualList.length > 0 && (
          <optgroup
            label={
              kind === "ELIM_VS_QUALIFIED"
                ? "2.º clasificado (cupo en juego)"
                : "Clasificados de grupo"
            }
          >
            {qualList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.groupName}
                {c.seed != null ? ` (${c.seed}º)` : ""}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}
