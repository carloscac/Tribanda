import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FIRST = [
  "Andrés", "Camilo", "Diego", "Esteban", "Felipe", "Gabriel", "Héctor", "Iván",
  "Jorge", "Kevin", "Leonardo", "Mauricio", "Nicolás", "Oscar", "Pablo", "Rafael",
];
const LAST = [
  "Álvarez", "Bermúdez", "Castaño", "Delgado", "Espinoza", "Franco", "García", "Herrera",
  "Ibáñez", "Jiménez", "Lozano", "Mejía", "Naranjo", "Ortiz", "Patiño", "Quintero",
];
const CLUBS = [
  "Chapinero", "Teusaquillo", "Medellín", "Cali", "Barranquilla", "Bucaramanga",
  "Pereira", "Manizales", "Cartagena", "Cúcuta",
];

function demoPlayers() {
  const rows = [];
  for (let i = 0; i < 64; i += 1) {
    const first = FIRST[i % FIRST.length];
    const last = LAST[Math.floor(i / FIRST.length) % LAST.length];
    const n = i + 1;
    rows.push({
      name: `${first} ${last}`,
      alias: `seed-${String(n).padStart(2, "0")}`,
      club: CLUBS[i % CLUBS.length],
    });
  }
  return rows;
}

async function main() {
  const user =
    (await prisma.user.findUnique({ where: { email: "ingcarloscacua@gmail.com" } })) ??
    (await prisma.user.findFirst({ orderBy: { createdAt: "desc" } }));
  if (!user) {
    throw new Error("No hay cuenta. Entra a /registro y vuelve a correr el seed.");
  }

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { sortOrder: "asc" },
  });
  if (categories.length < 3) {
    throw new Error("Faltan categorías Primera/Segunda/Tercera en esa cuenta.");
  }

  const specs = demoPlayers();
  const players = [];

  for (let i = 0; i < specs.length; i += 1) {
    const spec = specs[i];
    const category = categories[i % categories.length];
    const existing = await prisma.player.findFirst({
      where: { userId: user.id, alias: spec.alias },
    });
    if (existing) {
      players.push(
        await prisma.player.update({
          where: { id: existing.id },
          data: { name: spec.name, club: spec.club, categoryId: category.id },
        }),
      );
    } else {
      players.push(
        await prisma.player.create({
          data: {
            userId: user.id,
            name: spec.name,
            alias: spec.alias,
            club: spec.club,
            categoryId: category.id,
          },
        }),
      );
    }
  }

  const slugBase = "copa-64-demo";
  let tournament = await prisma.tournament.findFirst({
    where: { userId: user.id, name: "Copa 64 — prueba" },
  });

  if (tournament) {
    await prisma.match.deleteMany({ where: { tournamentId: tournament.id } });
    await prisma.group.deleteMany({ where: { tournamentId: tournament.id } });
    await prisma.inscription.deleteMany({ where: { tournamentId: tournament.id } });
    tournament = await prisma.tournament.update({
      where: { id: tournament.id },
      data: {
        name: "Copa 64 — prueba",
        venue: "Club Los Libertadores",
        date: new Date("2026-11-12T12:00:00"),
        status: "REGISTRATION",
        mix: "MIXED",
        equalInnings: true,
        tableCount: 8,
        groupSize: 4,
        qualifyPerGroup: 2,
        entryFee: 50000,
      },
    });
    const tables = await prisma.table.count({ where: { tournamentId: tournament.id } });
    if (tables !== 8) {
      await prisma.table.deleteMany({ where: { tournamentId: tournament.id } });
      await prisma.table.createMany({
        data: Array.from({ length: 8 }, (_, i) => ({ tournamentId: tournament!.id, number: i + 1 })),
      });
    }
  } else {
    tournament = await prisma.tournament.create({
      data: {
        userId: user.id,
        name: "Copa 64 — prueba",
        slug: `${slugBase}-${user.id.slice(-6)}`,
        venue: "Club Los Libertadores",
        date: new Date("2026-11-12T12:00:00"),
        status: "REGISTRATION",
        mix: "MIXED",
        equalInnings: true,
        tableCount: 8,
        groupSize: 4,
        qualifyPerGroup: 2,
        entryFee: 50000,
        tables: {
          create: Array.from({ length: 8 }, (_, i) => ({ number: i + 1 })),
        },
      },
    });
  }

  await prisma.inscription.createMany({
    data: players.map((player, i) => {
      const category = categories[i % categories.length];
      return {
        tournamentId: tournament!.id,
        playerId: player.id,
        categoryId: category.id,
        distance: category.distance,
        paid: i % 5 !== 0,
        checkedIn: i % 3 === 0,
      };
    }),
  });

  const paid = Math.ceil((64 * 4) / 5);
  const checked = Math.ceil(64 / 3);

  console.log(`Listo. 64 jugadores en "${tournament.name}".`);
  console.log(`Pagaron ~${paid}, check-in ~${checked}.`);
  console.log(`Ábrelo en /app/torneos luego Inscritos, y arma grupos cuando quieras.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
