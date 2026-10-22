import { notFound } from "next/navigation";
import { TournamentNav } from "@/components/TournamentNav";
import { prisma } from "@/lib/prisma";
import { finishBlockReason } from "@/lib/tournament-finish";
import { getSessionUser } from "@/lib/session-user";
import { canAccessOrganizerApp, tournamentDetailWhere } from "@/lib/tournament-access";

type NavKey = "mando" | "inscritos" | "grupos" | "cuadro" | "estadisticas" | "editar";

export async function TournamentNavLoader({
  id,
  current,
}: {
  id: string;
  current: NavKey;
}) {
  const user = await getSessionUser();
  if (!user || !canAccessOrganizerApp(user.role)) notFound();
  const tournament = await prisma.tournament.findFirst({
    where: tournamentDetailWhere(id, user.id, user.role),
    select: { name: true, slug: true, status: true },
  });
  if (!tournament) notFound();

  const pendingMatches = await prisma.match.count({
    where: { tournamentId: id, status: { in: ["SCHEDULED", "LIVE"] } },
  });
  const blockReason = finishBlockReason(tournament.status, pendingMatches);

  return (
    <TournamentNav
      id={id}
      name={tournament.name}
      current={current}
      publicSlug={tournament.slug}
      finish={{
        tournamentId: id,
        status: tournament.status,
        canClose: tournament.status === "LIVE" && blockReason === null,
        blockReason,
      }}
    />
  );
}
