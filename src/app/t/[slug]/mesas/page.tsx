import { PublicFloor } from "@/components/public/PublicFloor";
import { assertParticipantScreenVisible } from "@/lib/participant-screens";
import { loadPublicFloor, requirePublicTournament } from "@/lib/public-board";

export default async function PublicTablesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await requirePublicTournament(slug);
  await assertParticipantScreenVisible(event.userId, event.participantScreens, "mesas");
  const floor = await loadPublicFloor(event.id);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <PublicFloor
        tables={floor.tables}
        queue={floor.queue}
        equalInnings={event.equalInnings}
        showQueue
      />
    </main>
  );
}
