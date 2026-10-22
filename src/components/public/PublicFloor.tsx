import { publicScoreLine, type PublicMatchView, type PublicTableCard } from "@/lib/public-board";

function sideMeta(category: string | null, club: string | null, distance: number) {
  return [category, club, `a ${distance}`].filter(Boolean).join(" · ");
}

function LiveTable({
  table,
  large,
  equalInnings,
}: {
  table: PublicTableCard;
  large: boolean;
  equalInnings: boolean;
}) {
  const match = table.match;
  return (
    <article className="card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className={large ? "text-lg font-semibold" : "font-semibold"}>Mesa {table.number}</p>
        {match ? (
          <span className={`inline-flex items-center gap-1.5 text-sm ${match.paused ? "text-gold" : "text-live"}`}>
            <span className={`h-2 w-2 rounded-full ${match.paused ? "bg-gold" : "bg-live"}`} />
            {match.paused ? "Pausa" : "En juego"}
          </span>
        ) : (
          <span className="text-sm text-muted">Libre</span>
        )}
      </div>
      {match ? (
        <>
          <p className="text-xs tracking-wide text-muted uppercase">{match.phaseLabel}</p>
          <ScoreRow
            name={match.nameA}
            meta={sideMeta(match.categoryA, match.clubA, match.distanceA)}
            caroms={match.caromsA ?? 0}
            large={large}
          />
          <ScoreRow
            name={match.nameB}
            meta={sideMeta(match.categoryB, match.clubB, match.distanceB)}
            caroms={match.caromsB ?? 0}
            large={large}
          />
          <p className="mt-3 text-sm text-muted">
            {match.innings ?? 0} entradas
            {match.highRunA != null || match.highRunB != null
              ? ` · TM ${match.highRunA ?? 0}/${match.highRunB ?? 0}`
              : ""}
          </p>
          {equalInnings && (
            <p className="mt-1 text-xs text-gold">
              Igualdad de entradas: el segundo tiene derecho a su última entrada.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">Sin partido.</p>
      )}
    </article>
  );
}

function ScoreRow({
  name,
  meta,
  caroms,
  large,
}: {
  name: string | null;
  meta: string;
  caroms: number;
  large: boolean;
}) {
  return (
    <div className="mt-3 flex items-end justify-between gap-3">
      <div>
        <p className={large ? "text-2xl font-semibold" : "text-lg font-semibold"}>{name ?? "Por definir"}</p>
        <p className="text-sm text-muted">{meta}</p>
      </div>
      <p className={`font-serif tabular-nums ${large ? "text-5xl" : "text-4xl"}`}>{caroms}</p>
    </div>
  );
}

export function PublicFloor({
  tables,
  queue,
  equalInnings,
  large = false,
  showQueue = false,
}: {
  tables: PublicTableCard[];
  queue: PublicMatchView[];
  equalInnings: boolean;
  large?: boolean;
  showQueue?: boolean;
}) {
  const live = tables.filter((table) => table.match).length;
  const visibleQueue = queue.slice(0, 12);

  return (
    <div className="grid gap-8">
      <section>
        <h2 className="font-serif mb-3 text-2xl">Mesas</h2>
        {live === 0 && <p className="mb-3 text-sm text-muted">Ninguna mesa está en juego.</p>}
        <ul className={`grid gap-3 ${large ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
          {tables.map((table) => (
            <li key={table.number}>
              <LiveTable table={table} large={large} equalInnings={equalInnings} />
            </li>
          ))}
        </ul>
      </section>
      {showQueue && (
        <section>
          <h2 className="font-serif mb-3 text-2xl">Cola ({queue.length})</h2>
          {queue.length === 0 ? (
            <p className="text-sm text-muted">No hay partidos esperando mesa.</p>
          ) : (
            <ul className="grid gap-2">
              {visibleQueue.map((match) => (
                <li key={match.id} className="card py-3">
                  <p className="text-xs tracking-wide text-muted uppercase">{match.phaseLabel}</p>
                  <p className="mt-1 text-sm">
                    {match.nameA ?? "Por definir"} ({match.distanceA}) vs {match.nameB ?? "Por definir"} (
                    {match.distanceB})
                  </p>
                  <p className="mt-1 text-sm text-muted">{publicScoreLine(match)}</p>
                </li>
              ))}
            </ul>
          )}
          {queue.length > visibleQueue.length && (
            <p className="mt-3 text-sm text-muted">
              Y {queue.length - visibleQueue.length} partidos más en cola.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
