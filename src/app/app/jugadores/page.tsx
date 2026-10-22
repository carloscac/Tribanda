import { PlayerManager, type PlayerDirectoryRow } from "@/components/PlayerManager";
import { prisma } from "@/lib/prisma";
import { ensurePlayerCodes } from "@/lib/player-code";
import { ensureClosedTournamentHistory } from "@/lib/player-history";
import { careerAverage } from "@/lib/player-label";
import { playerPhotoSrc } from "@/lib/player-photo";
import { getSessionUser } from "@/lib/session-user";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const user = await getSessionUser();
  await ensurePlayerCodes();
  await ensureClosedTournamentHistory();

  const [players, categories] = await Promise.all([
    prisma.player.findMany({
      omit: { photoData: true },
      include: {
        category: true,
        tournamentRecords: { select: { isChampion: true, caroms: true, innings: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { userId: user!.id, active: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const rows: PlayerDirectoryRow[] = players.map((player) => {
    const championships = player.tournamentRecords.filter((row) => row.isChampion).length;
    const caroms = player.tournamentRecords.reduce((sum, row) => sum + row.caroms, 0);
    const innings = player.tournamentRecords.reduce((sum, row) => sum + row.innings, 0);
    return {
      id: player.id,
      userId: player.userId,
      code: player.code,
      name: player.name,
      alias: player.alias,
      documentId: player.documentId,
      email: player.email,
      phone: player.phone,
      club: player.club,
      photoSrc: playerPhotoSrc(player),
      categoryId: player.categoryId,
      category: player.category,
      championships,
      careerAverage: careerAverage(caroms, innings),
      tournamentsPlayed: player.tournamentRecords.length,
      handicap: player.handicap,
      canEdit: player.userId === user!.id || user!.role === "ADMIN",
    };
  });

  return (
    <main>
      <h1 className="page-title">Deportistas</h1>
      <p className="page-lead mb-6">
        Listado global: todos los organizadores ven a quienes ya se han inscrito. El código (TB-…)
        identifica la ficha. Al cerrar un torneo se guarda el palmarés y el promedio.
      </p>
      <PlayerManager players={rows} categories={categories} />
    </main>
  );
}
