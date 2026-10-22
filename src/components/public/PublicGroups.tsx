import { formatStatAverage } from "@/lib/stats";
import { publicPlayerLine, publicScoreLine, type PublicGroupView } from "@/lib/public-board";

export function PublicGroups({
  groups,
  qualifyPerGroup,
  compact = false,
}: {
  groups: PublicGroupView[];
  qualifyPerGroup: number;
  compact?: boolean;
}) {
  if (groups.length === 0) {
    return <p className="text-sm text-muted">Los grupos aparecen cuando el organizador los arma.</p>;
  }

  return (
    <div className="grid gap-4">
      {!compact && (
        <p className="text-sm text-muted">
          Pasan {qualifyPerGroup} por grupo. PJ y PG cuentan partidos cerrados y W.O. El promedio
          incluye la mesa en juego.
        </p>
      )}
      {groups.map((group) => (
        <section key={group.id} className="card">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-xl">
              {group.name}
              {group.tableNumber ? (
                <span className="ml-2 text-base font-sans font-normal text-muted">
                  · Mesa {group.tableNumber}
                </span>
              ) : null}
            </h2>
            <p className="text-sm text-muted">
              {group.statusLabel} · {group.played}/{group.total} partidos
            </p>
          </div>
          {group.tiebreakLabel && <p className="mb-3 text-sm text-gold">{group.tiebreakLabel}</p>}
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th>Dist.</th>
                  <th>PJ</th>
                  <th>PG</th>
                  <th>Prom.</th>
                  <th>TM</th>
                </tr>
              </thead>
              <tbody>
                {group.standings.map((row, index) => (
                  <tr key={`${row.name}-${row.distance}-${index}`}>
                    <td>
                      <span className="font-medium">{row.name}</span>
                      {row.qualified && <span className="ml-2 text-xs text-gold">Pasa</span>}
                      {(row.category || row.club) && (
                        <span className="block text-xs text-muted">
                          {[row.category, row.club].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className="tabular-nums">{row.distance}</td>
                    <td className="tabular-nums">{row.played}</td>
                    <td className="tabular-nums">{row.won}</td>
                    <td className="tabular-nums">{formatStatAverage(row.average)}</td>
                    <td className="tabular-nums">{row.highRun || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!compact && group.matches.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted">Partidos del grupo</summary>
              <ul className="mt-3 grid gap-2">
                {group.matches.map((match) => (
                  <li key={match.id} className="text-sm">
                    <span className={match.winnerSide === "A" ? "font-semibold text-gold" : ""}>
                      {publicPlayerLine(match.nameA, match.distanceA)}
                    </span>
                    {" vs "}
                    <span className={match.winnerSide === "B" ? "font-semibold text-gold" : ""}>
                      {publicPlayerLine(match.nameB, match.distanceB)}
                    </span>
                    <span className="text-muted">
                      {" · "}
                      {publicScoreLine(match)}
                      {match.tableNumber ? ` · Mesa ${match.tableNumber}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      ))}
    </div>
  );
}
