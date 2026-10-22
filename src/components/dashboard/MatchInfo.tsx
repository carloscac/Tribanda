export function MatchInfo({
  tournamentName,
  phaseLabel,
  tableNumber,
  innings,
  maxInnings,
  startedAt,
  paused,
  finished,
}: {
  tournamentName: string;
  phaseLabel: string;
  tableNumber: number;
  innings: number;
  maxInnings: number | null;
  startedAt: string | null;
  paused: boolean;
  finished: boolean;
}) {
  const start = startedAt
    ? new Date(startedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
    : "—";
  const state = finished ? "Cerrado" : paused ? "Pausa" : "En juego";

  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <p className="mb-3 text-sm font-semibold">Información del partido</p>
      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Torneo</dt>
          <dd className="truncate text-right">{tournamentName}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Fase</dt>
          <dd>{phaseLabel}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Mesa</dt>
          <dd>Mesa {String(tableNumber).padStart(2, "0")}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Entradas</dt>
          <dd>
            {innings}
            {maxInnings != null ? ` (o ${maxInnings} máx.)` : ""}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Inicio</dt>
          <dd>{start}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Estado</dt>
          <dd className={paused || finished ? "text-gold" : "text-live"}>{state}</dd>
        </div>
      </dl>
    </div>
  );
}
