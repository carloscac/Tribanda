-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "tiebreakNote" TEXT,
    CONSTRAINT "Group_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Group" ("id", "name", "sortOrder", "tournamentId") SELECT "id", "name", "sortOrder", "tournamentId" FROM "Group";
DROP TABLE "Group";
ALTER TABLE "new_Group" RENAME TO "Group";
CREATE TABLE "new_GroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "inscriptionId" TEXT NOT NULL,
    "seed" INTEGER,
    "qualified" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupMember_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GroupMember" ("groupId", "id", "inscriptionId") SELECT "groupId", "id", "inscriptionId" FROM "GroupMember";
DROP TABLE "GroupMember";
ALTER TABLE "new_GroupMember" RENAME TO "GroupMember";
CREATE UNIQUE INDEX "GroupMember_groupId_inscriptionId_key" ON "GroupMember"("groupId", "inscriptionId");
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_sideAId_fkey" FOREIGN KEY ("sideAId") REFERENCES "Inscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_sideBId_fkey" FOREIGN KEY ("sideBId") REFERENCES "Inscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Inscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("caromsA", "caromsB", "closeReason", "createdAt", "distanceA", "distanceB", "groupId", "highRunA", "highRunB", "id", "innings", "phase", "sideAId", "sideBId", "status", "tableId", "tournamentId", "winnerId") SELECT "caromsA", "caromsB", "closeReason", "createdAt", "distanceA", "distanceB", "groupId", "highRunA", "highRunB", "id", "innings", "phase", "sideAId", "sideBId", "status", "tableId", "tournamentId", "winnerId" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
