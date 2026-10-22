import { TournamentCatalog } from "@/components/public/TournamentCatalog";
import { loadTournamentCatalog, parseHistoryMonths } from "@/lib/public-tournaments";
import { requireParticipant } from "@/lib/session-user";

export const dynamic = "force-dynamic";

export default async function ParticipantTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ meses?: string }>;
}) {
  const user = await requireParticipant();
  const { meses } = await searchParams;
  const months = parseHistoryMonths(meses);
  const catalog = await loadTournamentCatalog(months, user);

  return (
    <main>
      <TournamentCatalog
        active={catalog.active}
        history={catalog.history}
        months={catalog.months}
        monthsHref={(next) =>
          next === 6 ? "/participante/torneos?meses=6" : "/participante/torneos"
        }
      />
    </main>
  );
}
