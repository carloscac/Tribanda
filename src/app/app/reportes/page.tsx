import { getActiveTournament } from "@/lib/active-tournament";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import { tournamentDetailWhere } from "@/lib/tournament-access";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ torneo?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) return null;
  const { torneo } = await searchParams;
  const active = await getActiveTournament({ userId: user.id, role: user.role });
  const tournamentId = torneo || active?.id;
  const tournament = tournamentId
    ? await prisma.tournament.findFirst({
        where: tournamentDetailWhere(tournamentId, user.id, user.role),
        select: { id: true, name: true },
      })
    : null;

  if (!tournament) {
    return (
      <main>
        <h1 className="page-title">Reportes</h1>
        <p className="page-lead">Abre un torneo para ver sus resultados.</p>
      </main>
    );
  }

  const finishedWhere = {
    tournamentId: tournament.id,
    status: { in: ["CLOSED", "WALKOVER"] },
    NOT: { closeReason: "bye" },
  };

  const [resultCount, results, walkovers, qualified] = await Promise.all([
    prisma.match.count({ where: finishedWhere }),
    prisma.match.findMany({
      where: finishedWhere,
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        table: { select: { number: true } },
        sideA: { include: { player: { select: { name: true } } } },
        sideB: { include: { player: { select: { name: true } } } },
      },
    }),
    prisma.match.count({
      where: { tournamentId: tournament.id, status: "WALKOVER" },
    }),
    prisma.groupMember.findMany({
      where: { qualified: true, group: { tournamentId: tournament.id } },
      include: {
        inscription: { include: { player: { select: { name: true } } } },
        group: { select: { name: true } },
      },
      orderBy: { seed: "asc" },
    }),
  ]);

  return (
    <main className="grid gap-6">
      <div>
        <h1 className="page-title">Reportes</h1>
        <p className="page-lead">Solo {tournament.name}. Resultados, walkovers y clasificados de este torneo.</p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="metric">
          <dt>Resultados</dt>
          <dd>{resultCount}</dd>
        </div>
        <div className="metric">
          <dt>Walkovers</dt>
          <dd>{walkovers}</dd>
        </div>
        <div className="metric">
          <dt>Clasificados</dt>
          <dd>{qualified.length}</dd>
        </div>
      </dl>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Últimos resultados</h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted">Todavía no hay partidos cerrados en este torneo.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Partido</th>
                  <th>Marcador</th>
                  <th>Mesa</th>
                  <th>Cierre</th>
                </tr>
              </thead>
              <tbody>
                {results.map((match) => (
                  <tr key={match.id}>
                    <td>
                      {match.sideA?.player.name ?? "—"} vs {match.sideB?.player.name ?? "—"}
                    </td>
                    <td className="tabular-nums">
                      {match.caromsA ?? "—"}–{match.caromsB ?? "—"}
                    </td>
                    <td className="tabular-nums">{match.table ? String(match.table.number).padStart(2, "0") : "—"}</td>
                    <td>
                      {match.status === "WALKOVER" ? (
                        <span className="badge badge-draft">W.O.</span>
                      ) : (
                        <span className="badge badge-muted">Cerrado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Clasificados de grupos</h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
          {qualified.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted">
              Aparecen cuando un grupo de este torneo termina y el sistema marca quién pasa.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th>Grupo</th>
                  <th>Puesto</th>
                </tr>
              </thead>
              <tbody>
                {qualified.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium">{row.inscription.player.name}</td>
                    <td>{row.group.name}</td>
                    <td className="tabular-nums">{row.seed ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
