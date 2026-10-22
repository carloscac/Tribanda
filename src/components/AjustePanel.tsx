"use client";

import { useActionState, useMemo } from "react";
import { generatePlayInMatches } from "@/lib/actions/play-in";
import { ajusteTagLabel, planRondaAjuste, type AjusteCandidate } from "@/lib/ajuste";

export function AjustePanel({
  tournamentId,
  bracketSize,
  firsts,
  seconds,
  reencauchados,
  hasOpenMatches,
  groupsFinalized,
  groupTiebreak,
}: {
  tournamentId: string;
  bracketSize: number;
  firsts: AjusteCandidate[];
  seconds: AjusteCandidate[];
  reencauchados: AjusteCandidate[];
  hasOpenMatches: boolean;
  groupsFinalized: boolean;
  groupTiebreak?: string;
}) {
  const planned = useMemo(
    () =>
      planRondaAjuste({
        bracketSize,
        firsts,
        seconds,
        reencauchados,
        groupTiebreak,
      }),
    [bracketSize, firsts, seconds, reencauchados, groupTiebreak],
  );
  const preview = "error" in planned ? null : planned;
  const previewError = "error" in planned ? planned.error : null;
  const plazaCount = firsts.length + seconds.length;

  const [state, formAction, pending] = useActionState(
    async (_p: { error?: string; ok?: boolean; created?: number } | null, fd: FormData) =>
      generatePlayInMatches(fd),
    null,
  );

  return (
    <div className="mb-6 rounded-2xl border border-gold/40 bg-gold/5 p-4">
      <h3 className="font-serif text-xl">Ronda de ajuste</h3>
      <p className="mt-1 text-sm text-muted">
        Quien ya clasificó en grupos tiene plaza en el cuadro de {bracketSize}. No juega repesca ni
        usa pase directo. La ronda de ajuste es solo entre reencauchados (eliminados de grupo) para
        llenar los cupos que faltan.
      </p>

      <p className="mt-3 text-sm">
        Ya tienen plaza: <strong>{plazaCount}</strong> ({firsts.length} primeros + {seconds.length}{" "}
        segundos).
      </p>

      {!groupsFinalized ? (
        <p className="mt-3 text-sm text-danger">
          Cierra la fase de grupos para incluir a los reencauchados y poder generar la ronda.
        </p>
      ) : null}

      {previewError ? <p className="mt-3 text-sm text-danger">{previewError}</p> : null}

      {preview ? (
        <div className="mt-4 grid gap-4 text-sm">
          <p>
            Cupos que faltan: <strong>{preview.slotsRemaining}</strong>. Reencauchados en lista:{" "}
            <strong>{preview.list.length}</strong>.
          </p>
          {preview.passDirect.length > 0 ? (
            <div>
              <p className="font-semibold">
                Reencauchados que entran sin jugar ({preview.passDirect.length})
              </p>
              <ul className="mt-1 grid gap-1 text-muted">
                {preview.passDirect.map((row) => (
                  <li key={row.inscriptionId}>
                    {row.name} · {row.groupName} · {ajusteTagLabel(row.tag)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {preview.byes > 0 ? (
            <p className="text-muted">
              El cuadro de {preview.bracketSize} queda con <strong>{preview.byes}</strong> bye
              {preview.byes === 1 ? "" : "s"} si no hay más reencauchados.
            </p>
          ) : null}
          {preview.matches.length > 0 ? (
            <div>
              <p className="font-semibold">Duelos de reencauche ({preview.matches.length})</p>
              {preview.rematchAvoided ? (
                <p className="mt-1 text-xs text-muted">
                  Se ajustó un cruce para no repetir un partido de grupos.
                </p>
              ) : null}
              <ul className="mt-1 grid gap-1">
                {preview.matches.map((match) => (
                  <li key={`${match.sideA.inscriptionId}-${match.sideB.inscriptionId}`}>
                    {match.sideA.name} vs {match.sideB.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : preview.list.length === 0 ? (
            <p className="text-muted">
              No hay reencauchados confirmados. Marca «Sí repesca» en los eliminados si quieres
              llenar cupos; si no, el cuadro se sortea con byes.
            </p>
          ) : (
            <p className="text-muted">Los reencauchados de la lista caben en los cupos libres.</p>
          )}
        </div>
      ) : null}

      <form action={formAction} className="mt-4">
        <input type="hidden" name="tournamentId" value={tournamentId} />
        <input type="hidden" name="bracketSize" value={bracketSize} />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={pending || !preview || hasOpenMatches || !groupsFinalized}
        >
          {pending
            ? "Generando…"
            : preview?.matches.length
              ? `Generar ${preview.matches.length} partido${preview.matches.length === 1 ? "" : "s"} de ajuste`
              : "Confirmar cupos de reencauche"}
        </button>
      </form>
      {hasOpenMatches ? (
        <p className="mt-2 text-xs text-muted">Ya hay partidos de ajuste en cola o en mesa.</p>
      ) : null}
      {state?.error ? <p className="mt-2 text-sm text-danger">{state.error}</p> : null}
      {state?.ok ? (
        <p className="mt-2 text-sm text-felt">
          {state.created
            ? `Creados ${state.created} partidos. Los clasificados de grupo siguen con su plaza.`
            : "Cupos listos. Ya puedes sortear el cuadro."}
        </p>
      ) : null}
    </div>
  );
}
