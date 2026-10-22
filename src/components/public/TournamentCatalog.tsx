import Link from "next/link";
import { TournamentCardCover } from "@/components/TournamentCardCover";
import { formatCOP, rosterCountLabel, statusBadgeClass } from "@/lib/labels";
import { phasePublicHref } from "@/lib/tournament-phase";
import {
  HISTORY_MONTHS_DEFAULT,
  HISTORY_MONTHS_MAX,
  type CatalogTournament,
  type HistoryMonths,
} from "@/lib/public-tournaments";

function TournamentCatalogCard({ row }: { row: CatalogTournament }) {
  const href = row.currentPhase ? phasePublicHref(row.slug, row.currentPhase) : `/t/${row.slug}`;
  return (
    <li className="card">
      <TournamentCardCover
        tournamentId={row.id}
        hasImage={row.hasImage}
        updatedAt={row.imageUpdatedAt}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{row.name}</h3>
            <span className={statusBadgeClass(row.status)}>{row.statusLabel}</span>
            {row.currentPhase && row.status !== "REGISTRATION" ? (
              <span className="rounded-full border border-felt/50 bg-felt/15 px-2.5 py-0.5 text-xs font-semibold text-felt">
                {row.currentPhase.label}
              </span>
            ) : null}
            {row.inscribed ? (
              <span className="rounded-full border border-felt/50 bg-felt/15 px-2.5 py-0.5 text-xs font-semibold text-felt">
                Ya inscrito
              </span>
            ) : row.pendingPayment ? (
              <span className="rounded-full border border-warning/50 bg-warning/15 px-2.5 py-0.5 text-xs font-semibold text-warning">
                Pendiente de pago
              </span>
            ) : row.blockedByCategory ? (
              <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
                No aplica a tu categoría
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {[
              row.mixLabel,
              row.venue,
              row.dateLabel,
              rosterCountLabel(row.inscriptionCount, row.plannedCapacity),
              row.entryFee != null && row.entryFee > 0 ? formatCOP(row.entryFee) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={href} className="btn btn-ghost text-sm">
            Ver
          </Link>
          {row.canSelfJoin ? (
            <Link href={`/t/${row.slug}/inscribirse`} className="btn btn-primary text-sm">
              Inscribirme
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function TournamentCatalog({
  active,
  history,
  months,
  monthsHref,
}: {
  active: CatalogTournament[];
  history: CatalogTournament[];
  months: HistoryMonths;
  monthsHref: (next: HistoryMonths) => string;
}) {
  return (
    <div className="grid gap-8">
      <section>
        <h1 className="text-2xl font-semibold">Torneos</h1>
        <p className="mt-1 text-sm text-muted">
          En curso o en inscripción, aunque no estés inscrito. Puedes abrir cada uno y ver su información.
        </p>
        {active.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No hay torneos en realización ahora mismo.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {active.map((row) => (
              <TournamentCatalogCard key={row.id} row={row} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Historial</h2>
            <p className="mt-1 text-sm text-muted">
              {months === HISTORY_MONTHS_DEFAULT
                ? "Torneos finalizados de los últimos 2 meses."
                : "Torneos finalizados de los últimos 6 meses."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={monthsHref(HISTORY_MONTHS_DEFAULT)}
              className={`rounded-full px-3 py-1 text-sm ${
                months === HISTORY_MONTHS_DEFAULT
                  ? "bg-felt text-cream"
                  : "border border-line bg-paper"
              }`}
            >
              2 meses
            </Link>
            <Link
              href={monthsHref(HISTORY_MONTHS_MAX)}
              className={`rounded-full px-3 py-1 text-sm ${
                months === HISTORY_MONTHS_MAX ? "bg-felt text-cream" : "border border-line bg-paper"
              }`}
            >
              6 meses
            </Link>
          </div>
        </div>
        {history.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No hay torneos cerrados en este período.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {history.map((row) => (
              <TournamentCatalogCard key={row.id} row={row} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
