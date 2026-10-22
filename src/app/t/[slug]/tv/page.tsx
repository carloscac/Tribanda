import { assertParticipantScreenVisible } from "@/lib/participant-screens";
import {
  loadPublicBracket,
  loadPublicFloor,
  loadPublicGroups,
  publicPhase,
  requirePublicTournament,
} from "@/lib/public-board";
import {
  PublicTvShell,
  type TvViewMode,
} from "@/components/public/PublicTvShell";

function parseViewMode(raw: string | undefined): TvViewMode {
  if (raw === "mesas" || raw === "fixture" || raw === "ambos") return raw;
  return "ambos";
}

export default async function PublicTvPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ vista?: string }>;
}) {
  const { slug } = await params;
  const { vista } = await searchParams;
  const event = await requirePublicTournament(slug);
  await assertParticipantScreenVisible(event.userId, event.participantScreens, "tv");
  const [floor, groups, bracket] = await Promise.all([
    loadPublicFloor(event.id),
    loadPublicGroups(event.id),
    loadPublicBracket(event.id),
  ]);
  const phase = publicPhase(groups, bracket.matches.length > 0);
  const meta = [event.statusLabel, event.venue, event.dateLabel].filter(Boolean).join(" · ");

  return (
    <PublicTvShell
      slug={event.slug}
      eventName={event.name}
      meta={meta}
      equalInnings={event.equalInnings}
      qualifyPerGroup={event.qualifyPerGroup}
      knockoutLayout={event.knockoutLayout}
      phase={phase}
      floor={floor}
      groups={groups}
      bracket={bracket}
      initialMode={parseViewMode(vista)}
    />
  );
}
