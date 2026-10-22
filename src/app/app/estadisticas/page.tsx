import { StatsBoard } from "@/components/StatsBoard";
import { TournamentNavLoader } from "@/components/TournamentNavLoader";
import { getActiveTournament } from "@/lib/active-tournament";
import { loadPlayerStats } from "@/lib/stats-data";
import { getSessionUser } from "@/lib/session-user";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ torneo?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) return null;
  const { torneo } = await searchParams;
  const active = await getActiveTournament({ userId: user.id, role: user.role });
  const tournamentId = torneo || active?.id;
  if (!tournamentId) {
    return (
      <main>
        <h1 className="page-title">Estadísticas</h1>
        <p className="page-lead">Abre un torneo para ver sus estadísticas.</p>
      </main>
    );
  }

  const data = await loadPlayerStats(user.id, user.role, tournamentId);

  return (
    <main>
      {data.selectedId && data.selectedName ? (
        <TournamentNavLoader id={data.selectedId} current="estadisticas" />
      ) : (
        <h1 className="page-title">Estadísticas</h1>
      )}
      <p className="page-lead mb-6">
        Promedio, ganados y mayor tacada de este torneo. Sin walkovers ni pases directos.
      </p>
      <StatsBoard
        tournaments={data.tournaments}
        selectedId={data.selectedId}
        matchCount={data.matchCount}
        groupMatchCount={data.groupMatchCount}
        rows={data.rows}
        groupRows={data.groupRows}
        leaders={data.leaders}
        groupTiebreak={data.groupTiebreak}
      />
    </main>
  );
}
