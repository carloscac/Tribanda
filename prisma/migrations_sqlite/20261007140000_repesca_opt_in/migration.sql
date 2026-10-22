ALTER TABLE "Inscription" ADD COLUMN "repescaOptIn" INTEGER;
ALTER TABLE "Inscription" ADD COLUMN "repescaFeePaid" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Tournament" ADD COLUMN "repescaFee" INTEGER;

ALTER TABLE "Match" ADD COLUMN "playInKind" TEXT;
