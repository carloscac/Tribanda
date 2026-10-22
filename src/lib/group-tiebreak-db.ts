import { prisma } from "@/lib/prisma";
import {
  DEFAULT_GROUP_TIEBREAK,
  parseGroupTiebreak,
  type GroupTiebreak,
} from "@/lib/group-standing";

let sidecarReady = false;

async function ensureSidecar() {
  if (sidecarReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS TournamentGroupTiebreak (
      tournamentId VARCHAR(191) NOT NULL,
      mode VARCHAR(191) NOT NULL,
      PRIMARY KEY (tournamentId)
    )
  `);
  sidecarReady = true;
}

/** Preferimos la tabla auxiliar: no depende de migrar `Tournament`. */
export async function readGroupTiebreak(tournamentId: string): Promise<GroupTiebreak> {
  try {
    await ensureSidecar();
    const stored = await prisma.$queryRaw<{ mode: string | null }[]>`
      SELECT mode FROM TournamentGroupTiebreak WHERE tournamentId = ${tournamentId} LIMIT 1
    `;
    if (stored[0]?.mode) return parseGroupTiebreak(stored[0].mode);
  } catch {
    /* sigue con la columna del torneo, si existe */
  }

  try {
    const rows = await prisma.$queryRaw<{ groupTiebreak: string | null }[]>`
      SELECT groupTiebreak FROM Tournament WHERE id = ${tournamentId} LIMIT 1
    `;
    return parseGroupTiebreak(rows[0]?.groupTiebreak);
  } catch {
    return DEFAULT_GROUP_TIEBREAK;
  }
}

export async function writeGroupTiebreak(tournamentId: string, mode: GroupTiebreak) {
  await ensureSidecar();
  await prisma.$executeRaw`
    INSERT INTO TournamentGroupTiebreak (tournamentId, mode)
    VALUES (${tournamentId}, ${mode})
    ON DUPLICATE KEY UPDATE mode = ${mode}
  `;
  try {
    await prisma.$executeRaw`
      UPDATE Tournament SET groupTiebreak = ${mode} WHERE id = ${tournamentId}
    `;
  } catch {
    /* la columna en Tournament puede no existir todavía */
  }

  const saved = await readGroupTiebreak(tournamentId);
  if (saved !== mode) {
    throw new Error("No se pudo persistir el criterio de clasificación.");
  }
}
