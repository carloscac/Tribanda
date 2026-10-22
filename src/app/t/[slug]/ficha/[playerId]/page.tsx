import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareResultButton } from "@/components/ShareResultButton";
import { appOrigin } from "@/lib/app-url";
import { APP_NAME } from "@/lib/brand";
import { loadShareCard } from "@/lib/share-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; playerId: string }>;
}): Promise<Metadata> {
  const { slug, playerId } = await params;
  const card = await loadShareCard(slug, playerId);
  if (!card) return { title: APP_NAME };
  const origin = await appOrigin();
  const title = `${card.playerName} · ${card.headline}`;
  return {
    title: { absolute: `${title} · ${APP_NAME}` },
    description: card.thirdPerson,
    openGraph: {
      title,
      description: card.thirdPerson,
      url: `${origin}${card.path}`,
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description: card.thirdPerson },
  };
}

export default async function ShareCardPage({
  params,
}: {
  params: Promise<{ slug: string; playerId: string }>;
}) {
  const { slug, playerId } = await params;
  const card = await loadShareCard(slug, playerId);
  if (!card) notFound();
  const meta = [card.category, card.dateLabel, card.venue].filter(Boolean).join(" · ");

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <article className="card text-center">
        <p className="text-xs tracking-[0.22em] text-gold">TRIBANDA</p>
        <h1 className="mt-2 font-serif text-4xl text-gold">{card.headline}</h1>
        <div className="mt-4 flex justify-center">
          {card.photoUrl ? (
            <img
              src={card.photoUrl}
              alt=""
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <span className="grid h-20 w-20 place-items-center rounded-full bg-felt/20 text-xl font-semibold text-felt">
              {card.playerName.slice(0, 1)}
            </span>
          )}
        </div>
        <p className="mt-3 text-2xl font-semibold">{card.playerName}</p>
        {card.club ? <p className="text-sm text-muted">{card.club}</p> : null}
        <p className="mt-3 text-lg">{card.tournamentName}</p>
        {meta ? <p className="mt-1 text-sm text-muted">{meta}</p> : null}
        <p className="mt-4 text-sm">{card.thirdPerson}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <ShareResultButton title={`${card.playerName} · ${card.headline}`} text={card.thirdPerson} path={card.path} />
          <Link href={`/t/${slug}`} className="btn btn-ghost px-3 py-1.5 text-sm">
            Ver torneo
          </Link>
        </div>
      </article>
    </main>
  );
}
