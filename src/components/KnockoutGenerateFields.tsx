"use client";

import { useEffect, useMemo, useState } from "react";
import {
  allowedBracketSizes,
  BRACKET_SIZES,
  knockoutLayoutLabel,
  suggestBracketSize,
  type KnockoutLayout,
} from "@/lib/knockout-format";

export function KnockoutGenerateFields({
  knockoutLayout,
  qualifiedCount,
  poolSize,
  koEligible,
  fillMode = "AUTO",
  bracketSize: controlledSize,
  onBracketSizeChange,
}: {
  knockoutLayout: KnockoutLayout;
  qualifiedCount: number;
  poolSize: number;
  koEligible?: number;
  fillMode?: "AUTO" | "PLAY_IN" | "MANUAL";
  bracketSize?: number;
  onBracketSizeChange?: (n: (typeof BRACKET_SIZES)[number]) => void;
}) {
  const suggested = useMemo(
    () => suggestBracketSize(qualifiedCount, poolSize),
    [qualifiedCount, poolSize],
  );
  const [internalSize, setInternalSize] = useState<number>(suggested);
  useEffect(() => {
    if (controlledSize == null) setInternalSize(suggested);
  }, [suggested, controlledSize]);
  const size = controlledSize ?? internalSize;
  const setSize = (n: number) => {
    const sized = n as (typeof BRACKET_SIZES)[number];
    onBracketSizeChange?.(sized);
    if (controlledSize == null) setInternalSize(sized);
  };
  const allowedSizes = allowedBracketSizes(poolSize, qualifiedCount);

  return (
    <div className="mb-4 grid gap-3">
      <p className="text-sm text-muted">
        Formato del torneo: <strong className="text-ink">{knockoutLayoutLabel(knockoutLayout)}</strong>
        {knockoutLayout === "SPLIT"
          ? ". Dos mitades del cuadro convergen en la final central."
          : ". Rondas en columnas hacia la final."}
      </p>
      <div className="field max-w-xs">
        <label htmlFor="bracketSize">Jugadores en el cuadro</label>
        <select
          id="bracketSize"
          name={onBracketSizeChange ? undefined : "bracketSize"}
          value={size}
          onChange={(e) => setSize(Number(e.target.value) as (typeof BRACKET_SIZES)[number])}
        >
          {allowedSizes.map((n) => (
            <option key={n} value={n}>
              {n} jugadores
              {n === suggested ? " (recomendado)" : ""}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted">
          {qualifiedCount} clasificados por grupo · {poolSize} en grupos
          {fillMode === "AUTO" ? (
            <>
              . Si eliges más plazas que clasificados, entran los mejores del ranking (automático).
            </>
          ) : fillMode === "PLAY_IN" ? (
            <>
              . Elige 32: los 3 mejores primeros quedan vs BYE y el resto se cruza para completar los
              16. Ahora hay {koEligible ?? 0} clasificados de grupo.
            </>
          ) : (
            <>
              . Modo manual: hace falta {size} plazas ocupadas (ahora {koEligible ?? 0}) antes de
              sortear.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
