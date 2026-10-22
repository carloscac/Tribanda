import { prisma } from "@/lib/prisma";

export const COPA_PRIVILEGE_ID = "cmvcwnnjg007yp91pxo0lnp9r";

/** Orden pedido para el listado de Copa Privilege (1 = primero). */
const COPA_PRIVILEGE_NAME_KEYS: [string, string][] = [
  ["sonia", "chala"],
  ["claudia", "chacon"],
  ["mario", "calderon"],
  ["dario", "ayala"],
  ["chepe", "forero"],
  ["alvaro", "echeverry"],
  ["miguel", "arango"],
  ["carolina", "matiz"],
  ["fernando", "castillo"],
  ["sergio", "giraldo"],
  ["francisco", "puentes"],
  ["pedro", "gonzalez"],
  ["alejo", "kike"],
  ["ruben", "cardenas"],
  ["mauricio", "cardenas"],
  ["janer", "gracia"],
  ["gustavo", "cardenas"],
  ["mari", "garzon"],
  ["luis", "roldan"],
  ["dumar", "otalora"],
  ["edward", "cruz"],
  ["elber", "parra"],
  ["adriana", "salazar"],
  ["carlos", "cacua"],
  ["alessandro", "acevedo"],
  ["jaime", "andres"],
  ["daniel", "ortiz"],
  ["javier", "martinez"],
  ["oscar", "arevalo"],
];

let tableReady = false;

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nameMatches(playerName: string, first: string, last: string) {
  const n = normalizeName(playerName);
  if (first === "janer") {
    return (n.includes("janer") || n.includes("haner")) && n.includes(last);
  }
  if (first === "edward") {
    return (n.includes("edward") || n.includes("eduard")) && n.includes(last);
  }
  if (first === "mari") {
    return n.includes("garzon") && (n.includes("mari") || n.includes("mariana"));
  }
  return n.includes(first) && n.includes(last);
}

async function ensureTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS TournamentListRank (
      tournamentId VARCHAR(191) NOT NULL,
      inscriptionId VARCHAR(191) NOT NULL,
      position INT NOT NULL,
      PRIMARY KEY (tournamentId, inscriptionId)
    )
  `);
  tableReady = true;
}

export async function readListRanks(tournamentId: string): Promise<Map<string, number>> {
  try {
    await ensureTable();
    if (tournamentId === COPA_PRIVILEGE_ID) {
      await seedCopaPrivilegeRanks();
    }
    const rows = await prisma.$queryRaw<{ inscriptionId: string; position: number }[]>`
      SELECT inscriptionId, position
      FROM TournamentListRank
      WHERE tournamentId = ${tournamentId}
    `;
    return new Map(rows.map((row) => [row.inscriptionId, Number(row.position)]));
  } catch {
    return new Map();
  }
}

async function seedCopaPrivilegeRanks() {
  const existing = await prisma.$queryRaw<{ c: bigint | number }[]>`
    SELECT COUNT(*) AS c FROM TournamentListRank WHERE tournamentId = ${COPA_PRIVILEGE_ID}
  `;
  if (Number(existing[0]?.c ?? 0) > 0) return;

  const inscriptions = await prisma.inscription.findMany({
    where: { tournamentId: COPA_PRIVILEGE_ID },
    select: { id: true, player: { select: { name: true } } },
  });

  const used = new Set<string>();
  const rows: { inscriptionId: string; position: number }[] = [];

  for (const [index, [first, last]] of COPA_PRIVILEGE_NAME_KEYS.entries()) {
    const found = inscriptions.find(
      (row) => !used.has(row.id) && nameMatches(row.player.name, first, last),
    );
    if (!found) continue;
    used.add(found.id);
    rows.push({ inscriptionId: found.id, position: index + 1 });
  }

  const leftovers = inscriptions
    .filter((row) => !used.has(row.id))
    .sort((a, b) => a.player.name.localeCompare(b.player.name, "es"));
  let next = COPA_PRIVILEGE_NAME_KEYS.length + 1;
  for (const row of leftovers) {
    rows.push({ inscriptionId: row.id, position: next });
    next += 1;
  }

  for (const row of rows) {
    await prisma.$executeRaw`
      INSERT INTO TournamentListRank (tournamentId, inscriptionId, position)
      VALUES (${COPA_PRIVILEGE_ID}, ${row.inscriptionId}, ${row.position})
      ON DUPLICATE KEY UPDATE position = ${row.position}
    `;
  }
}
