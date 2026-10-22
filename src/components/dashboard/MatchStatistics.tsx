import { formatAverage, type LiveSide } from "@/lib/dashboard";

export function MatchStatistics({
  sideA,
  sideB,
  innings,
}: {
  sideA: LiveSide | null;
  sideB: LiveSide | null;
  innings: number;
}) {
  const rows = [
    ["Promedio del partido", formatAverage(sideA?.average ?? 0), formatAverage(sideB?.average ?? 0)],
    ["Máxima serie", String(sideA?.highRun ?? 0), String(sideB?.highRun ?? 0)],
    ["Carambolas", String(sideA?.caroms ?? 0), String(sideB?.caroms ?? 0)],
    ["Entradas", String(Math.max(innings, 0)), String(Math.max(innings, 0))],
    ["Meta (hándicap)", sideA ? String(sideA.distance) : "—", sideB ? String(sideB.distance) : "—"],
  ];

  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <p className="mb-3 text-sm font-semibold">Estadísticas del partido</p>
      <table>
        <thead>
          <tr>
            <th className="py-1 pr-2" />
            <th className="py-1 pr-2 text-p1">{sideA?.name ?? "A"}</th>
            <th className="py-1 text-p2">{sideB?.name ?? "B"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-t border-line">
              <td className="py-1.5 pr-2 text-muted">{row[0]}</td>
              <td className="py-1.5 pr-2 tabular-nums">{row[1]}</td>
              <td className="py-1.5 tabular-nums">{row[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
