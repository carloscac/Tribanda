import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TOURNAMENT_ID = "cmuu0bem00005yckxl7v9acom";

const BATCH = [
  { name: "Andrés Mejía", documentId: "9012345601", club: "Chapinero" },
  { name: "Camilo Castaño", documentId: "9012345602", club: "Teusaquillo" },
  { name: "Diego Herrera", documentId: "9012345603", club: "Medellín" },
  { name: "Esteban Franco", documentId: "9012345604", club: "Cali" },
  { name: "Felipe García", documentId: "9012345605", club: "Barranquilla" },
  { name: "Gabriel Lozano", documentId: "9012345606", club: "Bucaramanga" },
  { name: "Héctor Naranjo", documentId: "9012345607", club: "Pereira" },
  { name: "Iván Ortiz", documentId: "9012345608", club: "Manizales" },
  { name: "Jorge Patiño", documentId: "9012345609", club: "Cartagena" },
  { name: "Kevin Quintero", documentId: "9012345610", club: "Cúcuta" },
  { name: "Leonardo Álvarez", documentId: "9012345611", club: "Chapinero" },
  { name: "Mauricio Bermúdez", documentId: "9012345612", club: "Teusaquillo" },
  { name: "Nicolás Delgado", documentId: "9012345613", club: "Medellín" },
  { name: "Oscar Espinoza", documentId: "9012345614", club: "Cali" },
  { name: "Pablo Ibáñez", documentId: "9012345615", club: "Barranquilla" },
];

function participantLoginEmail(documentId) {
  return `cedula+${documentId}@participante.tribanda`;
}

async function provisionParticipant(name, documentId) {
  const passwordHash = await bcrypt.hash(documentId, 10);
  const email = participantLoginEmail(documentId);
  const byDoc = await prisma.user.findFirst({ where: { documentId } });
  if (byDoc && byDoc.role !== "PARTICIPANT") {
    throw new Error(`Cédula ${documentId} en uso por otra cuenta.`);
  }
  if (byDoc) {
    return prisma.user.update({
      where: { id: byDoc.id },
      data: { name, passwordHash, email, active: true },
    });
  }
  return prisma.user.create({
    data: { name, email, documentId, passwordHash, role: "PARTICIPANT" },
  });
}

async function main() {
  const tournament = await prisma.tournament.findUnique({ where: { id: TOURNAMENT_ID } });
  if (!tournament) throw new Error("Torneo Copa Pruebas no encontrado.");

  const categories = await prisma.category.findMany({
    where: { userId: tournament.userId, active: true },
    orderBy: { sortOrder: "asc" },
  });

  let created = 0;
  for (let i = 0; i < BATCH.length; i += 1) {
    const spec = BATCH[i];
    const category = categories[i % categories.length];

    const dup = await prisma.player.findFirst({
      where: { userId: tournament.userId, documentId: spec.documentId },
    });
    if (dup) {
      console.log(`Omitido: ${spec.name}`);
      continue;
    }

    const participant = await provisionParticipant(spec.name, spec.documentId);
    const player = await prisma.player.create({
      data: {
        userId: tournament.userId,
        name: spec.name,
        documentId: spec.documentId,
        club: spec.club,
        categoryId: category.id,
      },
    });

    await prisma.inscription.create({
      data: {
        tournamentId: tournament.id,
        playerId: player.id,
        categoryId: category.id,
        distance: category.distance,
        paid: i % 3 !== 0,
        participantUserId: participant.id,
      },
    });
    created += 1;
    console.log(`OK: ${spec.name} · ${category.name} · cédula ${spec.documentId}`);
  }

  const total = await prisma.inscription.count({ where: { tournamentId: tournament.id } });
  console.log(`\n${created} nuevos. Total inscritos: ${total}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
