import { CommandCenter } from "@/components/CommandCenter";
import { PublicRefresh } from "@/components/public/PublicRefresh";
import { TournamentNavLoader } from "@/components/TournamentNavLoader";
import { getOrganizerTournamentContext } from "@/lib/load-organizer-tournament";
import { prisma } from "@/lib/prisma";

const include = {
  sideA: { include: { player: { omit: { photoData: true } }, category: true } },
  sideB: { include: { player: { omit: { photoData: true } }, category: true } },
  table: true,
} as const;

export default async function CommandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tournament } = await getOrganizerTournamentContext(id);

  const [tables, matches, groups] = await Promise.all([
    prisma.table.findMany({
      where: { tournamentId: id },
      orderBy: { number: "asc" },
    }),
    prisma.match.findMany({
      where: { tournamentId: id },
      include,
      orderBy: { createdAt: "asc" },
    }),
    prisma.group.findMany({
      where: { tournamentId: id, tableId: { not: null } },
      select: { id: true, tableId: true, table: { select: { number: true } } },
    }),
  ]);

  const live = matches.filter((m) => m.status === "LIVE");
  const queued = matches.filter(
    (m) => m.status === "SCHEDULED" && m.sideAId && m.sideBId,
  );
  const finished = matches.filter(
    (m) =>
      (m.status === "CLOSED" || m.status === "WALKOVER") && m.closeReason !== "bye",
  );

  return (
    <main>
      <PublicRefresh intervalMs={4000} />
      <TournamentNavLoader id={id} current="mando" />
      {matches.length === 0 ? (
        <p className="text-sm text-muted">
          Todavía no hay partidos. Primero genera los grupos.
        </p>
      ) : (
        <CommandCenter
          tournamentId={id}
          tables={tables}
          live={live}
          queued={queued}
          finished={finished}
          requireInnings={tournament.requireInnings}
          groupTables={groups
            .filter((g) => g.tableId && g.table)
            .map((g) => ({
              groupId: g.id,
              tableId: g.tableId!,
              tableNumber: g.table!.number,
            }))}
        />
      )}
    </main>
  );
}
