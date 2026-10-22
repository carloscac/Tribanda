import { formatAverage, type LiveSide } from "@/lib/dashboard";

export function PlayerScoreCard({
  side,
  tone,
  active,
  disabled,
  passDisabled,
  onAdd,
  onPass,
}: {
  side: LiveSide | null;
  tone: "p1" | "p2";
  active: boolean;
  disabled: boolean;
  passDisabled: boolean;
  onAdd: () => void;
  onPass: () => void;
}) {
  const accent = tone === "p1" ? "border-p1/70 bg-p1/10 text-p1" : "border-p2/70 bg-p2/10 text-p2";
  const avatar = tone === "p1" ? "bg-p1" : "bg-p2";
  const distance = side?.distance ?? 0;
  const caroms = side?.caroms ?? 0;
  const progress = distance > 0 ? Math.min(100, Math.round((caroms / distance) * 100)) : 0;
  const locked = disabled || !side;

  return (
    <article className={`rounded-2xl border px-4 py-4 ${active ? accent : "border-line bg-paper text-muted"}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className={`turn-chip ${active ? "" : "opacity-0"}`}>En turno</p>
        <p className="max-w-[10rem] truncate text-[11px] font-semibold tracking-wide text-muted uppercase">
          {side?.name ?? (tone === "p1" ? "Lado 1" : "Lado 2")}
        </p>
      </div>
      <div className="flex items-start gap-3">
        <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-line">
          {side?.photoUrl ? (
            <img src={side.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className={`flex h-full w-full items-center justify-center text-xl font-bold text-white ${avatar}`}>
              {side?.initials ?? "?"}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink">{side?.name ?? "Por definir"}</p>
          <p className="truncate text-xs text-muted">
            {side?.club ?? "Sin club"}
            {side?.category ? ` · ${side.category}` : ""}
          </p>
        </div>
      </div>
      <p className="mt-3 text-6xl leading-none font-bold text-ink tabular-nums">{caroms}</p>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>A {distance || "—"}</span>
          <span className="tabular-nums">{distance ? `${progress}%` : ""}</span>
        </div>
        <div className="distance-track" aria-hidden>
          <div className="distance-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-ink">
        <div>
          <dt className="text-xs text-muted">Serie</dt>
          <dd className="font-semibold tabular-nums">{side?.serie ?? 0}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Promedio</dt>
          <dd className="font-semibold tabular-nums">{formatAverage(side?.average ?? 0)}</dd>
        </div>
      </dl>
      <div className="mt-4 grid grid-cols-[1fr_3.5rem] gap-2">
        <button
          className={`score-btn w-full ${tone === "p1" ? "score-btn-p1" : "score-btn-p2"}`}
          type="button"
          disabled={locked}
          onClick={onAdd}
        >
          +1
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          disabled={locked || passDisabled}
          title="Entrada en 0 y pasa el turno"
          onClick={onPass}
        >
          0
        </button>
      </div>
    </article>
  );
}
