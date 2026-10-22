import { StatsBoard } from "@/components/StatsBoard";
import { getActiveTournament } from "@/lib/active-tournament";
import { loadPlayerStats } from "@/lib/stats-data";
import { getSessionUser } from "@/lib/session-user";

export default async function RankingPage({
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
        <h1 className="page-title">Ranking</h1>
        <p className="page-lead">Abre un torneo para ver su ranking.</p>
      </main>
    );
  }

  const data = await loadPlayerStats(user.id, user.role, tournamentId);

  return (
    <main>
      <h1 className="page-title">Ranking</h1>
      <p className="page-lead mb-6">
        {data.selectedName
          ? `Solo ${data.selectedName}. Promedio, victorias y mayor tacada de sus partidos cerrados.`
          : "Ese torneo no está en tu cuenta."}
      </p>
      <StatsBoard
        route="/app/ranking"
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
