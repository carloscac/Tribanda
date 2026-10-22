-- Plazas al cuadro y modos de sorteo
ALTER TABLE "Tournament" ADD COLUMN "knockoutFillMode" TEXT NOT NULL DEFAULT 'AUTO';
ALTER TABLE "Tournament" ADD COLUMN "knockoutDrawMode" TEXT NOT NULL DEFAULT 'FIXED';
ALTER TABLE "Inscription" ADD COLUMN "koEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Inscription" ADD COLUMN "koManualPick" BOOLEAN NOT NULL DEFAULT false;
