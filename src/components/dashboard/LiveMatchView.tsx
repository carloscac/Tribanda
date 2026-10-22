"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock3, MapPin, Trophy } from "lucide-react";
import { AverageChart } from "@/components/dashboard/AverageChart";
import { CaromTable } from "@/components/dashboard/CaromTable";
import { MatchHistory } from "@/components/dashboard/MatchHistory";
import { MatchInfo } from "@/components/dashboard/MatchInfo";
import { MatchScore } from "@/components/dashboard/MatchScore";
import { MatchStatistics } from "@/components/dashboard/MatchStatistics";
import { PlayerScoreCard } from "@/components/dashboard/PlayerScoreCard";
import { RecentMatches } from "@/components/dashboard/RecentMatches";
import { ScoreControls } from "@/components/dashboard/ScoreControls";
import { ResendTableAlertsButton } from "@/components/ResendTableAlertsButton";
import { closeLiveMatch, walkoverMatch } from "@/lib/actions/matches";
import { addCarom, passTurn, resetTable, togglePause, undoCarom } from "@/lib/actions/score";
import type { LiveMatchDTO } from "@/lib/dashboard";
import { applyAddCarom, applyPassTurn, applyUndoCarom } from "@/lib/live-score";

export function LiveMatchView({ data, backHref }: { data: LiveMatchDTO; backHref?: string }) {
  const router = useRouter();
  const [view, setView] = useState(data);
  const viewRef = useRef(data);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  const [confirmKind, setConfirmKind] = useState<"close" | "reset" | "walkA" | "walkB" | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const pending = useRef(0);
  const queue = useRef(Promise.resolve());
  const pop = useRef(0);
  const [, bump] = useState(0);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (pending.current === 0) {
      viewRef.current = data;
      setView(data);
    }
  }, [data]);

  function run(next: LiveMatchDTO, action: () => Promise<{ error?: string; ok?: boolean } | void>) {
    pop.current += 1;
    bump((n) => n + 1);
    viewRef.current = next;
    setView(next);
    setError(null);
    pending.current += 1;
    setBusy(true);
    queue.current = queue.current
      .then(async () => {
        const result = await action();
        if (result && "error" in result && result.error) setError(result.error);
      })
      .catch(() => setError("No se pudo guardar el golpe. Revisa la mesa."))
      .finally(() => {
        pending.current -= 1;
        if (pending.current === 0) {
          setBusy(false);
          router.refresh();
        }
      });
  }

  function fd(extra?: Record<string, string>) {
    const form = new FormData();
    form.set("matchId", data.matchId);
    if (extra) {
      for (const [key, value] of Object.entries(extra)) form.set(key, value);
    }
    return form;
  }

  return (
    <div
      className={
        focus
          ? "fixed inset-0 z-50 grid gap-3 overflow-y-auto bg-navy p-3"
          : "grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]"
      }
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {backHref && (
              <Link href={backHref} className="text-sm text-muted">
                ← Mando
              </Link>
            )}
            <h1 className="page-title mt-1 flex items-center gap-2">
              Partido en curso
              <span className={view.paused ? "badge badge-draft" : "badge badge-live"}>
                {view.paused ? "Pausa" : "En vivo"}
              </span>
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ResendTableAlertsButton matchId={view.matchId} />
            <p className="text-sm text-muted">
              {view.innings} entradas
              {view.maxInnings != null ? ` (o ${view.maxInnings} máx.)` : ""}
            </p>
            <button type="button" className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => setFocus((value) => !value)}>
              {focus ? "Vista completa" : "Marcador de mesa"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-muted">
          <span className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1">
            <MapPin size={14} /> Mesa {String(view.tableNumber).padStart(2, "0")}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1">
            <Trophy size={14} /> {view.phaseLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1">
            {view.tournamentName}
          </span>
          {view.liveStartedAt && (
            <span className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1">
              <Clock3 size={14} />
              {new Date(view.liveStartedAt).toLocaleTimeString("es-CO", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        {view.equalInnings && (
          <p className="alert alert-warn text-gold">
            Igualdad de entradas: el segundo tiene derecho a su última entrada.
          </p>
        )}
        {view.finished && (
          <p className="alert alert-ok">
            Partido cerrado
            {view.winnerName ? ` · gana ${view.winnerName}` : ""}
            {view.closeReason === "walkover" ? " · W.O." : ""}
          </p>
        )}

        <p className="text-xs text-muted">
          <strong>+1</strong> suma la carambola en esa tarjeta. <strong>0</strong> cierra la entrada sin punto y pasa el turno.
        </p>
        <div className={`grid gap-3 ${focus ? "" : "lg:grid-cols-[1fr_10rem_1fr]"}`}>
          <div key={`a-${pop.current}-${view.sideA?.caroms ?? 0}`} className="score-pop">
            <PlayerScoreCard
              side={view.sideA}
              tone="p1"
              active={view.currentSide === "A"}
              disabled={view.paused || view.finished}
              passDisabled={view.currentSide != null && view.currentSide !== "A"}
              onAdd={() => run(applyAddCarom(viewRef.current, "A"), () => addCarom(fd({ side: "A" })))}
              onPass={() => run(applyPassTurn(viewRef.current, "A"), () => passTurn(fd({ side: "A" })))}
            />
          </div>
          <MatchScore innings={view.innings} maxSerie={view.maxSerie} />
          <div key={`b-${pop.current}-${view.sideB?.caroms ?? 0}`} className="score-pop">
            <PlayerScoreCard
              side={view.sideB}
              tone="p2"
              active={view.currentSide === "B"}
              disabled={view.paused || view.finished}
              passDisabled={view.currentSide != null && view.currentSide !== "B"}
              onAdd={() => run(applyAddCarom(viewRef.current, "B"), () => addCarom(fd({ side: "B" })))}
              onPass={() => run(applyPassTurn(viewRef.current, "B"), () => passTurn(fd({ side: "B" })))}
            />
          </div>
        </div>

        {!focus && <CaromTable />}

        {!focus && <div className="grid gap-3 xl:grid-cols-3">
          <MatchHistory
            nameA={view.sideA?.name ?? "A"}
            nameB={view.sideB?.name ?? "B"}
            rows={view.history}
          />
          <MatchStatistics sideA={view.sideA} sideB={view.sideB} innings={view.innings} />
          <AverageChart
            nameA={view.sideA?.name ?? "A"}
            nameB={view.sideB?.name ?? "B"}
            points={view.averages}
          />
        </div>}
      </div>

      <aside className="grid gap-4">
        {!focus && <MatchInfo
          tournamentName={view.tournamentName}
          phaseLabel={view.phaseLabel}
          tableNumber={view.tableNumber}
          innings={view.innings}
          maxInnings={view.maxInnings}
          startedAt={view.liveStartedAt}
          paused={view.paused}
          finished={view.finished}
        />}
        {!focus && <RecentMatches tables={view.recent} />}
        {view.sideA && view.sideB && (
          <ScoreControls
            nameA={view.sideA.name}
            nameB={view.sideB.name}
            paused={view.paused}
            finished={view.finished}
            busy={busy}
            error={error}
            onUndo={() => run(applyUndoCarom(viewRef.current), () => undoCarom(fd()))}
            onPause={() => {
              const next = { ...viewRef.current, paused: !viewRef.current.paused };
              run(next, () => togglePause(fd()));
            }}
            onReset={() => setConfirmKind("reset")}
            onClose={() => setConfirmKind("close")}
            onWalkoverA={() => setConfirmKind("walkA")}
            onWalkoverB={() => setConfirmKind("walkB")}
            confirm={{
              kind: confirmKind,
              pending: confirmPending,
              onCancel: () => setConfirmKind(null),
              onConfirm: async () => {
                setConfirmPending(true);
                setError(null);
                let result: { error?: string } | void = undefined;
                if (confirmKind === "close") result = await closeLiveMatch(fd());
                else if (confirmKind === "reset") result = await resetTable(fd());
                else if (confirmKind === "walkA") {
                  result = await walkoverMatch(fd({ winnerId: view.sideA!.inscriptionId }));
                } else if (confirmKind === "walkB") {
                  result = await walkoverMatch(fd({ winnerId: view.sideB!.inscriptionId }));
                }
                setConfirmPending(false);
                if (result && result.error) {
                  setError(result.error);
                  return;
                }
                setConfirmKind(null);
                router.refresh();
              },
            }}
          />
        )}
      </aside>
    </div>
  );
}
