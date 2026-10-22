import type { AveragePoint } from "@/lib/dashboard";

export function AverageChart({
  nameA,
  nameB,
  points,
}: {
  nameA: string;
  nameB: string;
  points: AveragePoint[];
}) {
  const width = 320;
  const height = 140;
  const pad = 24;
  const maxY = Math.max(0.5, ...points.flatMap((p) => [p.avgA, p.avgB]));
  const maxX = Math.max(1, points.length - 1);

  function x(i: number) {
    return pad + (i / maxX) * (width - pad * 2);
  }
  function y(value: number) {
    return height - pad - (value / maxY) * (height - pad * 2);
  }

  const pathA = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.avgA)}`).join(" ");
  const pathB = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.avgB)}`).join(" ");

  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <p className="mb-3 text-sm font-semibold">Evolución del promedio</p>
      {points.length < 2 ? (
        <p className="text-sm text-muted">Se dibuja al completar al menos dos entradas.</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
            <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#243b57" />
            <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#243b57" />
            <path d={pathA} fill="none" stroke="#2f6feb" strokeWidth="2" />
            <path d={pathB} fill="none" stroke="#e23d3d" strokeWidth="2" />
          </svg>
          <p className="mt-2 text-xs text-muted">
            <span className="text-p1">{nameA}</span>
            {" · "}
            <span className="text-p2">{nameB}</span>
            {" · promedio = carambolas / entradas"}
          </p>
        </>
      )}
    </div>
  );
}
