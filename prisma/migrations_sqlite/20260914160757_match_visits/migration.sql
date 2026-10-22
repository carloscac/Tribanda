-- CreateTable
CREATE TABLE "MatchVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "inning" INTEGER NOT NULL,
    "side" TEXT NOT NULL,
    "caroms" INTEGER NOT NULL DEFAULT 0,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchVisit_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "groupId" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'GROUP',
    "round" INTEGER NOT NULL DEFAULT 0,
    "bracketSlot" INTEGER,
    "nextMatchId" TEXT,
    "nextSide" TEXT,
    "sideAId" TEXT,
    "sideBId" TEXT,
    "distanceA" INTEGER NOT NULL,
    "distanceB" INTEGER NOT NULL,
    "caromsA" INTEGER,
    "caromsB" INTEGER,
    "innings" INTEGER,
    "highRunA" INTEGER,
    "highRunB" INTEGER,
    "tableId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "winnerId" TEXT,
    "closeReason" TEXT,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "liveStartedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_sideAId_fkey" FOREIGN KEY ("sideAId") REFERENCES "Inscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_sideBId_fkey" FOREIGN KEY ("sideBId") REFERENCES "Inscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Inscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("bracketSlot", "caromsA", "caromsB", "closeReason", "createdAt", "distanceA", "distanceB", "groupId", "highRunA", "highRunB", "id", "innings", "nextMatchId", "nextSide", "phase", "round", "sideAId", "sideBId", "status", "tableId", "tournamentId", "winnerId") SELECT "bracketSlot", "caromsA", "caromsB", "closeReason", "createdAt", "distanceA", "distanceB", "groupId", "highRunA", "highRunB", "id", "innings", "nextMatchId", "nextSide", "phase", "round", "sideAId", "sideBId", "status", "tableId", "tournamentId", "winnerId" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
