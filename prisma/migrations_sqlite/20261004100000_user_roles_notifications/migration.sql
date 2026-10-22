-- AlterTable User
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'ORGANIZER';
ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable Player
ALTER TABLE "Player" ADD COLUMN "email" TEXT;

-- AlterTable Inscription
ALTER TABLE "Inscription" ADD COLUMN "participantUserId" TEXT;

-- CreateTable Notification
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tournamentId" TEXT,
    "inscriptionId" TEXT,
    "matchId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

UPDATE "User" SET role = 'ADMIN' WHERE email = 'ingcarloscacua@gmail.com';
