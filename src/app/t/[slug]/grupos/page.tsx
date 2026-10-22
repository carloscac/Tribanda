import { PublicGroups } from "@/components/public/PublicGroups";
import { assertParticipantScreenVisible } from "@/lib/participant-screens";
import { loadPublicGroups, requirePublicTournament } from "@/lib/public-board";

export default async function PublicGroupsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await requirePublicTournament(slug);
  await assertParticipantScreenVisible(event.userId, event.participantScreens, "grupos");
  const groups = await loadPublicGroups(event.id);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <PublicGroups groups={groups} qualifyPerGroup={event.qualifyPerGroup} />
    </main>
  );
}
