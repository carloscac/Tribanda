"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { ManualResultMatch } from "@/components/ManualResultForm";
import { RepescaSetup } from "@/components/RepescaSetup";
import type { AjusteCandidate } from "@/lib/ajuste";
import { setManualKnockoutPicks } from "@/lib/actions/play-in";
import type { KnockoutFillMode, PlayInCandidate, QualifiedForPlayIn } from "@/lib/knockout-entry";
import { FILL_MODE_LABEL } from "@/lib/knockout-entry";

type PlayInRow = ManualResultMatch & { status: string; playInKind?: string | null };

type RosterRow = {
  id: string;
  name: string;
  groupName: string;
  repescaOptIn: boolean | null;
  repescaFeePaid: boolean;
  bench?: boolean;
};

export function KnockoutEntryPanel({
  tournamentId,
  fillMode,
  groupQualified,
  koEligible,
  bracketSize,
  candidates,
  repescaPool = [],
  qualifiedPool = [],
  secondQualifiedPool = [],
  repescaRoster = [],
  repescaFee = null,
  hasKnockout,
  playInMatches = [],
  directPassCandidates = [],
  ajusteFirsts = [],
  ajusteSeconds = [],
  ajusteReencauchados = [],
  groupsFinalized = false,
}: {
  tournamentId: string;
  fillMode: KnockoutFillMode;
  groupQualified: number;
  koEligible: number;
  bracketSize: number;
  candidates: { id: string; name: string; groupName: string }[];
  repescaPool?: PlayInCandidate[];
  qualifiedPool?: QualifiedForPlayIn[];
  secondQualifiedPool?: QualifiedForPlayIn[];
  repescaRoster?: RosterRow[];
  repescaFee?: number | null;
  hasKnockout: boolean;
  playInMatches?: PlayInRow[];
  directPassCandidates?: { id: string; name: string; groupName: string; note: string }[];
  ajusteFirsts?: AjusteCandidate[];
  ajusteSeconds?: AjusteCandidate[];
  ajusteReencauchados?: AjusteCandidate[];
  groupsFinalized?: boolean;
}) {
  const slotsStillNeeded = Math.max(0, bracketSize - koEligible);
  const extraNeeded = slotsStillNeeded;
  const [manualState, manualAction, manualPending] = useActionState(
    async (_p: { error?: string; ok?: boolean } | null, fd: FormData) => setManualKnockoutPicks(fd),
    null,
  );
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const ready = koEligible >= bracketSize || (fillMode === "PLAY_IN" && koEligible >= groupQualified);
  const modeLabel = FILL_MODE_LABEL[fillMode];

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < extraNeeded) next.add(id);
      return next;
    });
  };

  const sortedCandidates = useMemo(
    () => [...candidates].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [candidates],
  );

  if (fillMode === "AUTO" || hasKnockout) return null;

  if (fillMode === "PLAY_IN") {
    return (
      <div className="card border border-line">
        <h2 className="font-serif mb-2 text-lg">Cuadro de {bracketSize}</h2>
        <p className="mb-3 text-sm text-muted">
          Se arma el árbol de {bracketSize}. Los <strong className="text-cream">3 mejores primeros</strong>{" "}
          quedan vs <strong className="text-cream">BYE</strong> y pasan a 16 sin jugar. El resto se cruza
          en dieciseisavos para ganar su cupo a 16; así el cuadro no se rompe.
        </p>
        <RepescaSetup
          tournamentId={tournamentId}
          bracketSize={bracketSize}
          extraNeeded={0}
          repescaFee={repescaFee}
          roster={repescaRoster}
          repescaPool={repescaPool}
          qualifiedPool={[]}
          secondQualifiedPool={[]}
          playInMatches={playInMatches}
        />
      </div>
    );
  }

  if (extraNeeded === 0) return null;

  return (
    <div className="card border border-line">
      <h2 className="font-serif mb-2 text-lg">Completar el cuadro de {bracketSize}</h2>
      <p className="mb-3 text-sm text-muted">
        {groupQualified} clasificados en grupos ({modeLabel}). Plazas al cuadro:{" "}
        <strong className="text-cream">{koEligible}</strong>/{bracketSize}
        {slotsStillNeeded > 0 ? (
          <>
            {" "}
            · faltan <strong className="text-cream">{slotsStillNeeded}</strong> para sortear
          </>
        ) : (
          " · listo para sortear"
        )}
        .
      </p>

      {fillMode === "MANUAL" && (
        <form action={manualAction} className="grid gap-3">
          <input type="hidden" name="tournamentId" value={tournamentId} />
          <input type="hidden" name="bracketSize" value={bracketSize} />
          <p className="text-sm text-muted">
            Elige {extraNeeded} jugador{extraNeeded === 1 ? "" : "es"} (
            <Link href={`/app/torneos/${tournamentId}/inscritos`} className="text-p1">
              Inscribir
            </Link>
            ).
          </p>
          {[...picked].map((id) => (
            <input key={id} type="hidden" name="inscriptionId" value={id} />
          ))}
          <ul className="max-h-48 overflow-y-auto rounded-lg border border-line divide-y divide-line">
            {sortedCandidates.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={picked.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                  {c.name}
                  <span className="text-muted">· {c.groupName}</span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="submit"
            className="btn btn-ghost max-w-xs border border-line"
            disabled={manualPending || picked.size !== extraNeeded}
          >
            {manualPending ? "Guardando…" : `Confirmar ${extraNeeded} plazas`}
          </button>
          {manualState?.error && <p className="text-sm text-danger">{manualState.error}</p>}
        </form>
      )}

      {ready && (
        <p className="mt-3 text-sm font-medium text-live">
          Plazas completas. Ya puedes generar y sortear el cuadro abajo.
        </p>
      )}
    </div>
  );
}
