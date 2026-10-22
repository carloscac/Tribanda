type MatchWriter = {
  match: {
    update: (args: {
      where: { id: string };
      data: {
        sideAId?: string | null;
        sideBId?: string | null;
        distanceA?: number;
        distanceB?: number;
      };
    }) => Promise<unknown>;
  };
};

export async function placeWinnerInNext(
  db: MatchWriter,
  nextMatchId: string | null,
  nextSide: string | null,
  inscriptionId: string,
  distance: number,
) {
  if (!nextMatchId || !nextSide) return;
  const data =
    nextSide === "B"
      ? { sideBId: inscriptionId, distanceB: distance }
      : { sideAId: inscriptionId, distanceA: distance };
  await db.match.update({ where: { id: nextMatchId }, data });
}

export async function clearWinnerFromNext(
  db: MatchWriter,
  nextMatchId: string | null,
  nextSide: string | null,
) {
  if (!nextMatchId || !nextSide) return;
  const data = nextSide === "B" ? { sideBId: null, distanceB: 1 } : { sideAId: null, distanceA: 1 };
  await db.match.update({ where: { id: nextMatchId }, data });
}

export function realKoWhere(tournamentId: string) {
  return {
    tournamentId,
    phase: "KO",
    OR: [
      { status: "LIVE" },
      { status: "WALKOVER" },
      { status: "CLOSED", closeReason: { not: "bye" } },
    ],
  };
}
