import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { careerAverage, formatCareerAverage, suggestedHandicap } from "@/lib/player-label";
import { placeName } from "@/lib/standing";
import { HandicapForm } from "@/components/HandicapForm";
import { getSessionUser } from "@/lib/session-user";

export const dynamic = "force-dynamic";

export default async function PlayerHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  const player = await prisma.player.findUnique({
    where: { id },
    include: {
      category: true,
      tournamentRecords: { orderBy: [{ tournamentDate: "desc" }, { createdAt: "desc" }] },
      handicapChanges: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  if (!player) notFound();
  const canEditHandicap = Boolean(user && (user.role === "ADMIN" || user.id === player.userId));

  const championships = player.tournamentRecords.filter((row) => row.isChampion).length;
  const caroms = player.tournamentRecords.reduce((sum, row) => sum + row.caroms, 0);
  const innings = player.tournamentRecords.reduce((sum, row) => sum + row.innings, 0);
  const general = careerAverage(caroms, innings);

  return (
    <main>
      <p className="mb-4">
        <Link href="/app/jugadores" className="text-sm text-p1">
          ← Deportistas
        </Link>
      </p>
      <h1 className="page-title">{player.name}</h1>
      <p className="page-lead mb-6">
        {player.code ?? "Sin código"}
        {player.alias ? ` · ${player.alias}` : ""}
        {player.club ? ` · ${player.club}` : ""}
      </p>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-paper p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Campeonatos</p>
          <p className="font-serif text-3xl">{championships}</p>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Promedio general</p>
          <p className="font-serif text-3xl">{formatCareerAverage(general)}</p>
          <p className="text-xs text-muted">
            {innings > 0 ? `${caroms} carambolas / ${innings} entradas` : "Aún sin entradas registradas"}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Handicap</p>
          <p className="font-serif text-3xl">{player.handicap ?? "—"}</p>
          <p className="text-xs text-muted">{player.tournamentRecords.length} torneos en historial</p>
        </div>
      </div>

      {canEditHandicap ? (
        <div className="mb-6 rounded-2xl border border-line bg-paper p-4">
          <h2 className="font-serif text-xl">Cambiar handicap</h2>
          <p className="mt-1 text-sm text-muted">
            Se basa en el palmarés (títulos y promedio). El cambio queda registrado.
          </p>
          <HandicapForm
            playerId={player.id}
            current={player.handicap}
            suggested={suggestedHandicap({
              current: player.handicap,
              championships,
              categoryDistance: player.category?.distance ?? null,
            })}
          />
          {player.handicapChanges.length > 0 ? (
            <ul className="mt-4 grid gap-1 text-sm text-muted">
              {player.handicapChanges.map((row) => (
                <li key={row.id}>
                  {row.previous ?? "—"} → {row.next}
                  {row.reason ? ` · ${row.reason}` : ""}
                  {row.changedByName ? ` · ${row.changedByName}` : ""}
                  {" · "}
                  {row.createdAt.toLocaleDateString("es-CO")}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
        {player.tournamentRecords.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted">
            Todavía no hay historial. Se guarda al finalizar cada torneo en el que participe.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Torneo</th>
                <th>Puesto</th>
                <th>PJ</th>
                <th>PG</th>
                <th>Promedio</th>
                <th>Alta serie</th>
              </tr>
            </thead>
            <tbody>
              {player.tournamentRecords.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="font-medium">{row.tournamentName}</div>
                    <div className="text-xs text-muted">
                      {row.tournamentDate
                        ? row.tournamentDate.toLocaleDateString("es-CO")
                        : "Sin fecha"}
                      {row.venue ? ` · ${row.venue}` : ""}
                    </div>
                  </td>
                  <td>
                    {row.isChampion ? (
                      <span className="badge badge-draft">Campeón</span>
                    ) : row.place ? (
                      placeName(row.place)
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{row.played}</td>
                  <td>{row.won}</td>
                  <td>{formatCareerAverage(row.average)}</td>
                  <td>{row.highRun > 0 ? row.highRun : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
