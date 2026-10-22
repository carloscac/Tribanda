import { redirect } from "next/navigation";
import { PublicRefresh } from "@/components/public/PublicRefresh";
import { AppLogo } from "@/components/AppLogo";
import { ParticipantHeaderNav } from "@/components/participant/ParticipantHeaderNav";
import { AdSlots } from "@/components/ads/AdSlots";
import { logoutOrganizer } from "@/lib/actions/auth";
import { loadPublicAds } from "@/lib/ads";
import { LegalFooter } from "@/components/DataProcessingConsent";
import { getSessionUser } from "@/lib/session-user";

export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  if (user.role !== "PARTICIPANT") {
    if (user.role === "ADMIN") redirect("/app/admin");
    redirect("/app");
  }

  const ads = await loadPublicAds();

  return (
    <div className="app-shell min-h-screen">
      <PublicRefresh intervalMs={5000} />
      <header className="sticky top-0 z-40 border-b border-line bg-surface px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <AppLogo size="xs" href="/participante" />
            <p className="truncate text-sm font-semibold text-cream">Hola, {user.name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ParticipantHeaderNav />
            <form action={logoutOrganizer}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm font-semibold"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <AdSlots interstitial={ads.interstitial} banner={ads.banner} wide={ads.wide} />
        {children}
        <LegalFooter />
      </div>
    </div>
  );
}
