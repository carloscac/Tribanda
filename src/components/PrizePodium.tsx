import { placeName } from "@/lib/standing";

export function PrizePodium({
  rows,
  prizeSlots,
}: {
  rows: { place: number; name: string }[];
  prizeSlots: number;
}) {
  if (rows.length === 0) return null;

  return (
    <section className="mb-6 grid gap-3">
      <div>
        <h2 className="text-lg font-semibold">Puestos</h2>
        {prizeSlots > 2 && (
          <p className="page-lead">
            Hasta el {placeName(prizeSlots).toLowerCase()}, según los premios del torneo. Si varios
            caen en la misma ronda, queda más arriba quien más se acercó a su distancia.
          </p>
        )}
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => (
          <li key={row.place} className="card">
            <p className="text-xs font-semibold tracking-wide text-gold uppercase">{placeName(row.place)}</p>
            <p className="mt-1 font-semibold">{row.name}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
