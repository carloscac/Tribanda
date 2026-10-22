import { PrismaClient } from "@prisma/client";

/** Sube esto tras cambiar `schema.prisma` para no reutilizar un cliente viejo en `next dev`. */
const PRISMA_CLIENT_REVISION = 11;

type PrismaGlobal = {
  prisma?: PrismaClient;
  prismaRevision?: number;
};

const globalForPrisma = globalThis as unknown as PrismaGlobal;

function createPrismaClient() {
  return new PrismaClient();
}

let prisma: PrismaClient;
if (process.env.NODE_ENV !== "production") {
  if (
    !globalForPrisma.prisma ||
    globalForPrisma.prismaRevision !== PRISMA_CLIENT_REVISION
  ) {
    void globalForPrisma.prisma?.$disconnect();
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaRevision = PRISMA_CLIENT_REVISION;
  }
  prisma = globalForPrisma.prisma;
} else {
  prisma = globalForPrisma.prisma ?? createPrismaClient();
  globalForPrisma.prisma = prisma;
}

export { prisma };
