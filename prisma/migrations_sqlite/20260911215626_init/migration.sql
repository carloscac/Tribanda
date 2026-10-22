-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "distance" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alias" TEXT,
    "phone" TEXT,
    "club" TEXT,
    "categoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Player_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "venue" TEXT,
    "date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "mix" TEXT NOT NULL DEFAULT 'MIXED',
    "singleCategoryId" TEXT,
    "equalInnings" BOOLEAN NOT NULL DEFAULT true,
    "maxInnings" INTEGER,
    "tableCount" INTEGER NOT NULL DEFAULT 4,
    "groupSize" INTEGER NOT NULL DEFAULT 4,
    "qualifyPerGroup" INTEGER NOT NULL DEFAULT 2,
    "prizeChampion" BOOLEAN NOT NULL DEFAULT true,
    "prizeHighRun" BOOLEAN NOT NULL DEFAULT true,
    "prizeBestAverage" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tournament_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    CONSTRAINT "Table_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Inscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "categoryId" TEXT,
    "distance" INTEGER NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Inscription_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Inscription_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inscription_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_slug_key" ON "Tournament"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Table_tournamentId_number_key" ON "Table"("tournamentId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Inscription_tournamentId_playerId_key" ON "Inscription"("tournamentId", "playerId");
