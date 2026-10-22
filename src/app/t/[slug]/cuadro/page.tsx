import { PublicBracket } from "@/components/public/PublicBracket";
import { assertParticipantScreenVisible } from "@/lib/participant-screens";
import { loadPublicBracket, requirePublicTournament } from "@/lib/public-board";

export default async function PublicBracketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await requirePublicTournament(slug);
  await assertParticipantScreenVisible(event.userId, event.participantScreens, "cuadro");
  const bracket = await loadPublicBracket(event.id);

  return (
    <main className="mx-auto max-w-6xl px-3 py-3 sm:px-4 sm:py-6">
      <PublicBracket
        matches={bracket.matches}
        totalRounds={bracket.totalRounds}
        knockoutLayout={event.knockoutLayout}
      />
    </main>
  );
}
