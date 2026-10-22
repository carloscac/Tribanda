import type { Metadata } from "next";
import { PublicChrome } from "@/components/public/PublicChrome";
import { PublicRefresh } from "@/components/public/PublicRefresh";
import { APP_NAME } from "@/lib/brand";
import { resolveVisibleParticipantScreens } from "@/lib/participant-screens";
import { requirePublicTournament } from "@/lib/public-board";
import { parseRole } from "@/lib/roles";
import { AdSlots } from "@/components/ads/AdSlots";
import { loadPublicAds } from "@/lib/ads";
import { loadPublicJoinState } from "@/lib/self-register";
import { PublicLegalFooter } from "@/components/DataProcessingConsent";
import { appOrigin } from "@/lib/app-url";
import { getSessionUser } from "@/lib/session-user";
import { tournamentImageSrc } from "@/lib/tournament-image";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await requirePublicTournament(slug);
  const origin = await appOrigin();
  const description = [event.venue, event.dateLabel].filter(Boolean).join(" · ") || event.name;
  const image = event.hasImage
    ? `${origin}${tournamentImageSrc(event.id, event.imageUpdatedAt)}`
    : undefined;
  return {
    title: `${event.name} · ${APP_NAME}`,
    description,
    openGraph: {
      title: event.name,
      description,
      url: `${origin}/t/${slug}`,
      siteName: APP_NAME,
      type: "website",
      images: image ? [{ url: image, alt: event.name }] : undefined,
    },
  };
}

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await requirePublicTournament(slug);
  const visibleScreens = await resolveVisibleParticipantScreens(
    event.userId,
    event.participantScreens,
  );

  const session = await getSessionUser();
  const role = session ? parseRole(session.role) : null;
  const panelHref =
    role === "ADMIN" || role === "ORGANIZER"
      ? `/app/torneos/${event.id}/mando`
      : null;
  const participantHomeHref = role === "PARTICIPANT" ? "/participante" : null;
  const loginHref =
    role === "PARTICIPANT"
      ? null
      : `/entrar?rol=participante&next=${encodeURIComponent(`/t/${slug}`)}`;
  const join = await loadPublicJoinState(event, session);
  const ads = await loadPublicAds(event.id);

  return (
    <div className="app-shell min-h-screen">
      <PublicRefresh />
      <PublicChrome
        event={event}
        visibleScreens={visibleScreens}
        panelHref={panelHref}
        participantHomeHref={participantHomeHref}
        loginHref={loginHref}
        alreadyInscribed={join.confirmed}
        shareHref={join.inscription ? `/t/${slug}/ficha/${join.inscription.playerId}` : null}
        pendingPayment={join.pendingPayment}
        canSelfJoin={join.canSelfJoin}
        blockedByCategory={join.blockedByCategory}
      />
      {ads.interstitial || ads.banner || ads.wide ? (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <AdSlots interstitial={ads.interstitial} banner={ads.banner} wide={ads.wide} />
        </div>
      ) : null}
      {children}
      <div className="mx-auto max-w-6xl px-4 pb-8">
        <PublicLegalFooter />
      </div>
    </div>
  );
}
