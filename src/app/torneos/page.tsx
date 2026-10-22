import Link from "next/link";
import { AppLogo } from "@/components/AppLogo";
import { AdSlots } from "@/components/ads/AdSlots";
import { TournamentCatalog } from "@/components/public/TournamentCatalog";
import { loadPublicAds } from "@/lib/ads";
import { loadTournamentCatalog, parseHistoryMonths } from "@/lib/public-tournaments";
import { LegalFooter } from "@/components/DataProcessingConsent";
import { getSessionUser } from "@/lib/session-user";

export const dynamic = "force-dynamic";

export default async function PublicTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ meses?: string }>;
}) {
  const session = await getSessionUser();
  const { meses } = await searchParams;
  const months = parseHistoryMonths(meses);
  const catalog = await loadTournamentCatalog(
    months,
    session?.role === "PARTICIPANT" ? session : null,
  );
  const ads = await loadPublicAds();

  return (
    <div className="app-shell min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-surface px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <AppLogo size="xs" href="/" />
          <div className="flex shrink-0 items-center gap-2">
            {session?.role === "PARTICIPANT" ? (
              <Link
                href="/participante"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-gold"
              >
                Mis torneos
              </Link>
            ) : (
              <Link
                href="/entrar?rol=participante&next=%2Ftorneos"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-gold"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <AdSlots interstitial={ads.interstitial} banner={ads.banner} wide={ads.wide} />
        <TournamentCatalog
          active={catalog.active}
          history={catalog.history}
          months={catalog.months}
          monthsHref={(next) => (next === 6 ? "/torneos?meses=6" : "/torneos")}
        />
        <LegalFooter />
      </main>
    </div>
  );
}
