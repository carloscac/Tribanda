import type { HistoryRow } from "@/lib/dashboard";

export function MatchHistory({
  nameA,
  nameB,
  rows,
}: {
  nameA: string;
  nameB: string;
  rows: HistoryRow[];
}) {
  const visible = rows.slice(-8);

  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <p className="mb-3 text-sm font-semibold">Serie por entradas</p>
      {visible.length === 0 ? (
        <p className="text-sm text-muted">Aún no hay entradas anotadas.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th className="py-1 pr-2">Entrada</th>
              <th className="py-1 pr-2">{nameA}</th>
              <th className="py-1">{nameB}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.inning} className={row.current ? "bg-p1/15 font-semibold" : ""}>
                <td className="py-1 pr-2 tabular-nums">{row.inning}</td>
                <td className="py-1 pr-2 tabular-nums">{row.caromsA}</td>
                <td className="py-1 tabular-nums">{row.caromsB}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
