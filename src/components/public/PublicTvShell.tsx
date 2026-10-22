"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { AppLogo } from "@/components/AppLogo";
import { PublicBracket } from "@/components/public/PublicBracket";
import { PublicFloor } from "@/components/public/PublicFloor";
import { PublicGroups } from "@/components/public/PublicGroups";
import type {
  PublicGroupView,
  PublicMatchView,
  PublicTableCard,
} from "@/lib/public-board";

export type TvViewMode = "mesas" | "fixture" | "ambos";

const MODES: { id: TvViewMode; label: string }[] = [
  { id: "mesas", label: "Mesas" },
  { id: "fixture", label: "Cuadro" },
  { id: "ambos", label: "Ambos" },
];

type Props = {
  slug: string;
  eventName: string;
  meta: string;
  equalInnings: boolean;
  qualifyPerGroup: number;
  knockoutLayout: string;
  phase: "wait" | "groups" | "bracket";
  floor: { tables: PublicTableCard[]; queue: PublicMatchView[] };
  groups: PublicGroupView[];
  bracket: { matches: PublicMatchView[]; totalRounds: number };
  initialMode: TvViewMode;
};

export function PublicTvShell({
  slug,
  eventName,
  meta,
  equalInnings,
  qualifyPerGroup,
  knockoutLayout,
  phase,
  floor,
  groups,
  bracket,
  initialMode,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<TvViewMode>(initialMode);

  const pickMode = useCallback(
    (next: TvViewMode) => {
      setMode(next);
      router.replace(`/t/${slug}/tv?vista=${next}`, { scroll: false });
    },
    [router, slug],
  );

  const showMesas = mode === "mesas" || mode === "ambos";
  const showFixture = mode === "fixture" || mode === "ambos";
  const split = mode === "ambos";

  const fixturePanel =
    phase === "groups" ? (
      <PublicGroups groups={groups} qualifyPerGroup={qualifyPerGroup} compact />
    ) : phase === "bracket" ? (
      <PublicBracket
        matches={bracket.matches}
        totalRounds={bracket.totalRounds}
        stacked
        knockoutLayout={knockoutLayout}
      />
    ) : (
      <p className="text-sm text-muted">El cuadro y los grupos se publican cuando arranque el torneo.</p>
    );

  return (
    <main
      className={
        split
          ? "grid min-h-screen gap-6 p-4 lg:grid-cols-[1.15fr_1fr] lg:p-6"
          : "min-h-screen p-4 lg:p-6"
      }
    >
      <header className={split ? "col-span-full mb-0 flex flex-wrap items-end justify-between gap-3" : "mb-4 flex flex-wrap items-end justify-between gap-3"}>
        <div className="flex flex-wrap items-end gap-3">
          <AppLogo size="xs" framed />
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl">{eventName}</h1>
            <p className="mt-1 text-sm text-muted">{meta}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm"
            role="tablist"
            aria-label="Qué mostrar en pantalla"
          >
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={mode === m.id}
                onClick={() => pickMode(m.id)}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  mode === m.id ? "bg-felt text-white" : "text-muted hover:text-ink"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <Link href={`/t/${slug}`} className="text-sm text-muted">
            Salir de TV
          </Link>
        </div>
      </header>

      {showMesas && (
        <section className="min-w-0">
          {!split && <h2 className="mb-3 text-lg font-semibold">Mesas en vivo</h2>}
          <PublicFloor
            tables={floor.tables}
            queue={floor.queue}
            equalInnings={equalInnings}
            large={!split || showFixture}
          />
        </section>
      )}

      {showFixture && (
        <section className="min-w-0">
          {!split && <h2 className="mb-3 text-lg font-semibold">Grupos y cuadro</h2>}
          {fixturePanel}
        </section>
      )}
    </main>
  );
}
