"use client";

import { useMemo, useState } from "react";
import type { GroupTiebreak } from "@/lib/group-standing";
import { groupTiebreakShortLabel } from "@/lib/group-standing";
import type { PlayerStatRow, StatsLeaders } from "@/lib/stats";
import { compareStatsByTiebreak, formatStatAverage } from "@/lib/stats";

export function PublicLeaders({ leaders }: { leaders: StatsLeaders }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Leader
        title="Mejor promedio"
        name={leaders.average?.name}
        value={leaders.average ? formatStatAverage(leaders.average.average) : null}
        detail={leaders.average ? `${leaders.average.innings} entradas` : "Sin entradas registradas"}
      />
      <Leader
        title="Mayor tacada"
        name={leaders.highRun?.name}
        value={leaders.highRun ? String(leaders.highRun.highRun) : null}
        detail={leaders.highRun ? "en un partido cerrado" : "Todavía no hay tacada"}
      />
      <Leader
        title="Más ganados"
        name={leaders.wins?.name}
        value={leaders.wins ? String(leaders.wins.won) : null}
        detail={leaders.wins ? `${leaders.wins.played} jugados` : "Todavía no hay victorias"}
      />
    </div>
  );
}

function Leader({
  title,
  name,
  value,
  detail,
}: {
  title: string;
  name?: string;
  value: string | null;
  detail: string;
}) {
  return (
    <div className="card">
      <p className="text-xs tracking-wider text-muted uppercase">{title}</p>
      <p className="mt-1 font-semibold">{name ?? "—"}</p>
      <p className="font-serif mt-1 text-2xl text-gold tabular-nums">{value ?? "—"}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

type SortKey = "classification" | "name" | "group" | "won" | "average" | "highRun";

export function PublicStatsTable({
  rows,
  groupRows = [],
  groupMatchCount = 0,
  groupTiebreak = "CAROMS",
}: {
  rows: PlayerStatRow[];
  groupRows?: PlayerStatRow[];
  groupMatchCount?: number;
  groupTiebreak?: GroupTiebreak;
}) {
  const [scope, setScope] = useState<"groups" | "all">(groupMatchCount > 0 ? "groups" : "all");
  const [sortKey, setSortKey] = useState<SortKey>("classification");
  const source = scope === "groups" && groupRows.length > 0 ? groupRows : rows;

  const ordered = useMemo(() => {
    return [...source].sort((a, b) => {
      if (sortKey === "classification") return compareStatsByTiebreak(a, b, groupTiebreak);
      if (sortKey === "group") return (a.groupSort ?? 99) - (b.groupSort ?? 99);
      if (sortKey === "name") return a.name.localeCompare(b.name, "es");
      if (sortKey === "average") return (b.average ?? -1) - (a.average ?? -1);
      if (sortKey === "highRun") return b.highRun - a.highRun;
      return b.won - a.won;
    });
  }, [source, sortKey, groupTiebreak]);

  if (rows.length === 0 && groupRows.length === 0) {
    return (
      <p className="text-sm text-muted">
        Cierra partidos con carambolas para ver promedio, ganados y tacada mayor.
      </p>
    );
  }

  function head(key: SortKey, label: string) {
    return (
      <th>
        <button type="button" className="text-left uppercase tracking-wider" onClick={() => setSortKey(key)}>
          {label}
          {sortKey === key ? " ↓" : ""}
        </button>
      </th>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">
        Clasificación: {groupTiebreakShortLabel(groupTiebreak)}. Pulsa las columnas para reordenar.
      </p>
      {groupMatchCount > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-sm ${
              scope === "groups" ? "bg-felt text-cream" : "border border-line bg-paper"
            }`}
            onClick={() => setScope("groups")}
          >
            Fase de grupos
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-sm ${
              scope === "all" ? "bg-felt text-cream" : "border border-line bg-paper"
            }`}
            onClick={() => setScope("all")}
          >
            Todo el torneo
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="data-table">
          <thead>
            <tr>
              {head("classification", "#")}
              {head("name", "Jugador")}
              {head("group", "Grupo")}
              <th>Cat.</th>
              <th>PJ</th>
              {head("won", "PG")}
              <th>PP</th>
              <th>Car.</th>
              <th>Ent.</th>
              {head("average", "Prom.")}
              {head("highRun", "TM")}
            </tr>
          </thead>
          <tbody>
            {ordered.map((row, index) => (
              <tr key={row.playerId}>
                <td className="tabular-nums text-muted">{index + 1}</td>
                <td className="font-medium">{row.name}</td>
                <td className="text-muted">{row.groupName ?? "—"}</td>
                <td className="text-muted">{row.category ?? "—"}</td>
                <td className="tabular-nums">{row.played}</td>
                <td className="tabular-nums">{row.won}</td>
                <td className="tabular-nums">{row.lost}</td>
                <td className="tabular-nums">{row.caroms}</td>
                <td className="tabular-nums">{row.innings || "—"}</td>
                <td className="tabular-nums">{formatStatAverage(row.average)}</td>
                <td className="tabular-nums">{row.highRun || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
