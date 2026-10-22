-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "Group_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "inscriptionId" TEXT NOT NULL,
    CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupMember_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "groupId" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'GROUP',
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

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_inscriptionId_key" ON "GroupMember"("groupId", "inscriptionId");
