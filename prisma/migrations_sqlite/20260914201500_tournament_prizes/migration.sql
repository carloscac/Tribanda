-- CreateTable
CREATE TABLE "TournamentPrize" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "place" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    CONSTRAINT "TournamentPrize_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentPrize_tournamentId_place_key" ON "TournamentPrize"("tournamentId", "place");
