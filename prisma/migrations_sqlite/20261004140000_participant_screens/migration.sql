-- Pantallas visibles para deportistas en /t/{slug}
ALTER TABLE "Tournament" ADD COLUMN "participantScreens" TEXT NOT NULL DEFAULT '{"inicio":true,"grupos":true,"cuadro":true,"mesas":true,"stats":true,"tv":true}';
