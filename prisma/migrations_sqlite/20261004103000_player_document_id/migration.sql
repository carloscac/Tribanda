-- AlterTable Player: cédula para vincular participantes
ALTER TABLE "Player" ADD COLUMN "documentId" TEXT;

-- AlterTable User: cédula en cuenta participante
ALTER TABLE "User" ADD COLUMN "documentId" TEXT;

CREATE UNIQUE INDEX "User_documentId_key" ON "User"("documentId");
CREATE INDEX "Player_userId_documentId_idx" ON "Player"("userId", "documentId");
