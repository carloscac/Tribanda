"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GroupTiebreak } from "@/lib/group-standing";
import { groupTiebreakShortLabel } from "@/lib/group-standing";
import type { PlayerStatRow, StatsLeaders, TournamentOption } from "@/lib/stats";
import { compareStatsByTiebreak, formatStatAverage } from "@/lib/stats";

type SortKey =
  | "classification"
  | "name"
  | "group"
  | "category"
  | "played"
  | "won"
  | "lost"
  | "caroms"
  | "innings"
  | "average"
  | "highRun";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Jugador" },
  { key: "group", label: "Grupo" },
  { key: "category", label: "Cat." },
  { key: "played", label: "PJ" },
  { key: "won", label: "PG" },
  { key: "lost", label: "PP" },
  { key: "caroms", label: "Car." },
  { key: "innings", label: "Ent." },
  { key: "average", label: "Prom." },
  { key: "highRun", label: "TM" },
];

function sortRows(
  rows: PlayerStatRow[],
  key: SortKey,
  dir: "asc" | "desc",
  mode: GroupTiebreak,
) {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "classification") {
      const cmp = compareStatsByTiebreak(a, b, mode);
      return dir === "asc" ? -cmp : cmp;
    }
    if (key === "group") {
      const ga = a.groupSort ?? 99;
      const gb = b.groupSort ?? 99;
      return sign * (ga - gb) || a.name.localeCompare(b.name, "es");
    }
    if (key === "name" || key === "category") {
      return sign * (a[key] ?? "").localeCompare(b[key] ?? "", "es");
    }
    if (key === "average") {
      return sign * ((a.average ?? -1) - (b.average ?? -1)) || a.name.localeCompare(b.name, "es");
    }
    return sign * (a[key] - b[key]) || a.name.localeCompare(b.name, "es");
  });
}

export function StatsBoard({
  tournaments,
  selectedId,
  matchCount,
  rows,
  groupRows = [],
  groupMatchCount = 0,
  leaders,
  groupTiebreak = "CAROMS",
  route = "/app/estadisticas",
}: {
  tournaments: TournamentOption[];
  selectedId: string | null;
  matchCount: number;
  rows: PlayerStatRow[];
  groupRows?: PlayerStatRow[];
  groupMatchCount?: number;
  leaders: StatsLeaders;
  groupTiebreak?: GroupTiebreak;
  route?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"groups" | "all">(groupMatchCount > 0 ? "groups" : "all");
  const [sortKey, setSortKey] = useState<SortKey>("classification");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const source = scope === "groups" && groupRows.length > 0 ? groupRows : rows;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = term
      ? source.filter((row) =>
          [row.name, row.club, row.category, row.groupName]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(term)),
        )
      : source;
    return sortRows(base, sortKey, sortDir, groupTiebreak);
  }, [source, q, sortKey, sortDir, groupTiebreak]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" || key === "category" || key === "group" ? "asc" : "desc");
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="field min-w-[16rem] flex-1">
          <label htmlFor="stats-torneo">Torneo</label>
          <select
            id="stats-torneo"
            value={selectedId ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              if (value) {
                router.push(`${route}?torneo=${value}`);
                router.refresh();
              }
            }}
          >
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            </select>
        </div>
        <p className="pb-2 text-sm text-muted">
          {matchCount === 0
            ? "Aún no hay partidos cerrados para contar."
            : `${matchCount} partido${matchCount === 1 ? "" : "s"} cerrado${matchCount === 1 ? "" : "s"} · sin W.O. ni pases`}
        </p>
      </div>

      <p className="text-sm text-muted">
        Orden de clasificación: {groupTiebreakShortLabel(groupTiebreak)}. Pulsa <strong>#</strong> para
        volver a ese orden y validar el desempate.
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

      {rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <LeaderCard
            title="Mejor promedio"
            name={leaders.average?.name}
            value={leaders.average ? formatStatAverage(leaders.average.average) : null}
            detail={leaders.average ? `${leaders.average.innings} entradas` : "Sin entradas registradas"}
          />
          <LeaderCard
            title="Mayor tacada"
            name={leaders.highRun?.name}
            value={leaders.highRun ? String(leaders.highRun.highRun) : null}
            detail={leaders.highRun ? "en un partido cerrado" : "Todavía no hay tacada"}
          />
          <LeaderCard
            title="Más ganados"
            name={leaders.wins?.name}
            value={leaders.wins ? String(leaders.wins.won) : null}
            detail={leaders.wins ? `${leaders.wins.played} jugados` : "Todavía no hay victorias"}
          />
        </div>
      )}

      {rows.length > 0 && (
        <input
          className="max-w-sm rounded-lg border border-line bg-paper px-3 py-2"
          placeholder="Buscar jugador…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">
            {rows.length === 0
              ? "Cierra partidos con carambolas para ver promedio, ganados y tacada mayor."
              : "Nadie coincide con la búsqueda."}
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">
                  <button type="button" className="text-left uppercase tracking-wider" onClick={() => toggleSort("classification")}>
                    #
                    {sortKey === "classification" ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                  </button>
                </th>
                {COLUMNS.map((col) => (
                  <th key={col.key}>
                    <button type="button" className="text-left uppercase tracking-wider" onClick={() => toggleSort(col.key)}>
                      {col.label}
                      {sortKey === col.key ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, index) => (
                <tr key={row.playerId}>
                  <td>
                    <span className={`rank-pill ${index < 3 ? `rank-${index + 1}` : "text-muted"}`}>
                      {index + 1}
                    </span>
                  </td>
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
        )}
      </div>
    </div>
  );
}

function LeaderCard({
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
      <p className="text-xs uppercase tracking-wider text-muted">{title}</p>
      <p className="mt-1 font-semibold">{name ?? "—"}</p>
      <p className="mt-1 font-serif text-2xl tabular-nums text-gold">{value ?? "—"}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}
