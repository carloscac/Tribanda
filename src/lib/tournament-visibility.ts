import { prisma } from "@/lib/prisma";

export async function loadHiddenTournamentIds() {
  try {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM Tournament WHERE hidden = 1
    `;
    return new Set(rows.map((row) => row.id));
  } catch {
    return new Set<string>();
  }
}

export async function loadTournamentHidden(tournamentId: string) {
  try {
    const rows = await prisma.$queryRaw<{ hidden: number | boolean }[]>`
      SELECT hidden FROM Tournament WHERE id = ${tournamentId} LIMIT 1
    `;
    return Boolean(rows[0]?.hidden);
  } catch {
    return false;
  }
}

export async function loadTournamentHiddenMap(ids: string[]) {
  const hidden = await loadHiddenTournamentIds();
  return new Map(ids.map((id) => [id, hidden.has(id)]));
}

export async function saveTournamentHidden(tournamentId: string, hidden: boolean) {
  await prisma.$executeRaw`
    UPDATE Tournament SET hidden = ${hidden} WHERE id = ${tournamentId}
  `;
}
