import { AdManager } from "@/components/admin/AdManager";
import { listAdSlides, loadAdminAds } from "@/lib/ads";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session-user";

export const dynamic = "force-dynamic";

export default async function AdminAdsPage() {
  await requireAdmin();
  const rows = await loadAdminAds();
  const slideRows = await listAdSlides();
  const slidesByAd = new Map<string, { id: string; createdAt: string }[]>();
  for (const slide of slideRows) {
    const list = slidesByAd.get(slide.adId) ?? [];
    list.push({ id: slide.id, createdAt: slide.createdAt.toISOString() });
    slidesByAd.set(slide.adId, list);
  }
  const ads = rows.map((row) => ({
    ...row,
    provider: row.provider ?? "CUSTOM",
    embed: row.embed ?? null,
    active: Boolean(row.active),
    tournamentId: row.tournamentId ?? null,
    tournamentName: row.tournamentName ?? null,
    views: Number(row.views ?? 0),
    slides: slidesByAd.get(row.id) ?? [],
  }));
  const tournaments = await prisma.tournament.findMany({
    select: { id: true, name: true, date: true },
    orderBy: [{ date: "desc" }, { name: "asc" }],
  });

  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="page-title">Publicidad</h1>
      <p className="page-lead mb-6">
        Elige si el anuncio se ve en toda la aplicación o solo al entrar a un torneo. Puedes pasar
        un video de YouTube (pega la URL) o un anuncio de Google AdSense (ID de editor ca-pub-… y
        slot). La ventana grande aparece al entrar. El banner muestra la imagen ancha y, igual que el
        aviso pequeño, se cierra con la X. En el banner puedes subir varias imágenes: pasan una tras otra.
        Arriba de
        cada anuncio verás cuántas veces se mostró: una por visita, aunque recarguen la página.
      </p>
      <AdManager ads={ads} tournaments={tournaments} />
    </main>
  );
}
