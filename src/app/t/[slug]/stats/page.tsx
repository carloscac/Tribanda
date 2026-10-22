import { PublicLeaders, PublicStatsTable } from "@/components/public/PublicStats";
import { assertParticipantScreenVisible } from "@/lib/participant-screens";
import { loadPublicStats, requirePublicTournament } from "@/lib/public-board";

export default async function PublicStatsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await requirePublicTournament(slug);
  await assertParticipantScreenVisible(event.userId, event.participantScreens, "stats");
  const stats = await loadPublicStats(event.id);

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6">
      <p className="text-sm text-muted">
        Promedio, ganados y mayor tacada. Sin walkovers ni pases directos.
        {stats.matchCount > 0
          ? ` ${stats.matchCount} partido${stats.matchCount === 1 ? "" : "s"} cerrado${stats.matchCount === 1 ? "" : "s"}.`
          : ""}
      </p>
      {stats.rows.length > 0 && <PublicLeaders leaders={stats.leaders} />}
      <PublicStatsTable
        rows={stats.rows}
        groupRows={stats.groupRows}
        groupMatchCount={stats.groupMatchCount}
        groupTiebreak={stats.groupTiebreak}
      />
    </main>
  );
}
