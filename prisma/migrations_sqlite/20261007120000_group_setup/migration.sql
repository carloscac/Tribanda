-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "plannedCapacity" INTEGER;
ALTER TABLE "Tournament" ADD COLUMN "groupsFinalized" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN "maxMembers" INTEGER NOT NULL DEFAULT 4;

UPDATE "Group" SET "maxMembers" = (
  SELECT "groupSize" FROM "Tournament" WHERE "Tournament"."id" = "Group"."tournamentId"
);

UPDATE "Tournament" SET "groupsFinalized" = 1 WHERE "id" IN (SELECT DISTINCT "tournamentId" FROM "Group");
