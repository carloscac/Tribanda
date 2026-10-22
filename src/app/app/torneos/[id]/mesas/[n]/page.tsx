import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveMatchView } from "@/components/dashboard/LiveMatchView";
import { getOrganizerTournamentContext } from "@/lib/load-organizer-tournament";
import { loadLiveMatch } from "@/lib/live-match";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

export default async function TablePage({
  params,
}: {
  params: Promise<{ id: string; n: string }>;
}) {
  const { id, n } = await params;
  const number = Number(n);
  const user = await getSessionUser();
  if (!user || !Number.isInteger(number)) notFound();
  await getOrganizerTournamentContext(id);

  const table = await prisma.table.findFirst({
    where: { tournamentId: id, number },
  });
  if (!table) notFound();

  const live = await prisma.match.findFirst({
    where: { tableId: table.id, status: "LIVE" },
    select: { id: true },
  });

  if (!live) {
    return (
      <main>
        <Link href={`/app/torneos/${id}/mando`} className="text-sm text-muted">
          ← Mando
        </Link>
        <h1 className="mt-2 text-3xl font-semibold">Mesa {table.number}</h1>
        <p className="mt-4 text-muted">Libre. Asigna un partido desde el mando.</p>
      </main>
    );
  }

  const data = await loadLiveMatch(live.id, user.id, user.role);
  if (!data) notFound();

  return (
    <main>
      <LiveMatchView data={data} backHref={`/app/torneos/${id}/mando`} />
    </main>
  );
}
