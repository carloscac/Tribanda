ALTER TABLE "Tournament" ADD COLUMN "prizePoolPercent" INTEGER;
ALTER TABLE "Tournament" ADD COLUMN "prizeShareMode" TEXT NOT NULL DEFAULT 'FIXED';
ALTER TABLE "TournamentPrize" ADD COLUMN "sharePercent" INTEGER;
