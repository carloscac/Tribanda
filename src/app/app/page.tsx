import Link from "next/link";
import { LiveMatchView } from "@/components/dashboard/LiveMatchView";
import { PublicRefresh } from "@/components/public/PublicRefresh";
import { getActiveTournament } from "@/lib/active-tournament";
import { findLiveMatchForUser, loadLiveMatch } from "@/lib/live-match";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

async function loadOverview(tournamentId: string) {
  const [registered, paid, tournament, roster, matches, tables] = await Promise.all([
    prisma.inscription.count({ where: { tournamentId } }),
    prisma.inscription.count({ where: { tournamentId, paid: true } }),
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { plannedCapacity: true },
    }),
    prisma.inscription.findMany({
      where: { tournamentId },
      select: {
        id: true,
        paid: true,
        player: { select: { id: true, name: true, alias: true, club: true, code: true } },
        category: { select: { name: true } },
      },
      orderBy: { player: { name: "asc" } },
    }),
    prisma.match.groupBy({
      by: ["status"],
      where: { tournamentId },
      _count: { _all: true },
    }),
    prisma.table.count({ where: { tournamentId } }),
  ]);

  const countOf = (rows: { status: string; _count: { _all: number } }[], status: string) =>
    rows.find((row) => row.status === status)?._count._all ?? 0;

  return {
    registered,
    paid,
    capacity: tournament?.plannedCapacity ?? null,
    roster,
    tables,
    liveMatches: countOf(matches, "LIVE"),
    closed: countOf(matches, "CLOSED"),
  };
}

function Metrics({
  overview,
}: {
  overview: Awaited<ReturnType<typeof loadOverview>>;
}) {
  const cupo = overview.capacity != null ? String(overview.capacity) : "—";
  const items = [
    ["Registrados / cupo", `${overview.registered} / ${cupo}`],
    ["Inscritos (pagaron)", overview.paid],
    ["En juego", overview.liveMatches],
    ["Cerradas", overview.closed],
    ["Mesas", overview.tables],
  ] as const;

  return (
    <dl className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map(([label, value]) => (
        <div key={label} className="metric">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Roster({
  tournamentId,
  roster,
}: {
  tournamentId: string;
  roster: Awaited<ReturnType<typeof loadOverview>>["roster"];
}) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Deportistas del torneo</h2>
          <p className="text-sm text-muted">Quienes se registraron en este torneo.</p>
        </div>
        <Link href={`/app/torneos/${tournamentId}`} className="text-sm text-gold">
          Gestionar inscritos
        </Link>
      </div>
      {roster.length === 0 ? (
        <p className="empty">Todavía no hay deportistas registrados en este torneo.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Club</th>
                <th>Pago</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((row) => (
                <tr key={row.id}>
                  <td className="font-mono text-sm">{row.player.code || "—"}</td>
                  <td>
                    <Link href={`/app/jugadores/${row.player.id}`} className="font-medium text-p1">
                      {row.player.name}
                    </Link>
                    {row.player.alias ? (
                      <div className="text-xs text-muted">{row.player.alias}</div>
                    ) : null}
                  </td>
                  <td>{row.category?.name ?? "—"}</td>
                  <td className="text-muted">{row.player.club || "—"}</td>
                  <td>{row.paid ? "Pagó" : "Pendiente"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const tournament = await getActiveTournament({ userId: user.id, role: user.role });
  if (!tournament) {
    return (
      <main>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-lead">Crea un torneo para ver inscritos, mesas y marcador.</p>
      </main>
    );
  }

  const overview = await loadOverview(tournament.id);
  const live = await findLiveMatchForUser(user.id, tournament.id, user.role);

  if (!live) {

    return (
      <main>
        <PublicRefresh intervalMs={5000} />
        <h1 className="page-title">Dashboard</h1>
        <p className="page-lead mb-5">
          No hay un partido en mesa. El marcador aparece aquí cuando asignas un cruce desde el mando.
        </p>
        <Metrics overview={overview} />
        <Roster tournamentId={tournament.id} roster={overview.roster} />
        <div className="empty flex flex-wrap items-center gap-2">
          <Link href={`/app/torneos/${tournament.id}/mando`} className="btn btn-primary">
            Mando · {tournament.name}
          </Link>
          <Link href="/app/torneos" className="btn btn-ghost">
            Ver torneos
          </Link>
        </div>
      </main>
    );
  }

  const data = await loadLiveMatch(live.id, user.id, user.role);
  if (!data) {
    return (
      <main>
        <p className="text-muted">No se pudo cargar el partido en vivo.</p>
      </main>
    );
  }

  return (
    <main>
      <PublicRefresh intervalMs={5000} />
      <Metrics overview={overview} />
      <Roster tournamentId={tournament.id} roster={overview.roster} />
      <LiveMatchView data={data} />
    </main>
  );
}
