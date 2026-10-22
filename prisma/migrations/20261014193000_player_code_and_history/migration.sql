-- AlterTable
ALTER TABLE `Player` ADD COLUMN `code` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Tournament` ADD COLUMN `historyCaptured` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `PlayerTournamentRecord` (
    `id` VARCHAR(191) NOT NULL,
    `playerId` VARCHAR(191) NOT NULL,
    `tournamentKey` VARCHAR(191) NOT NULL,
    `tournamentId` VARCHAR(191) NULL,
    `tournamentName` VARCHAR(191) NOT NULL,
    `tournamentSlug` VARCHAR(191) NOT NULL,
    `tournamentDate` DATETIME(3) NULL,
    `venue` VARCHAR(191) NULL,
    `place` INTEGER NULL,
    `isChampion` BOOLEAN NOT NULL DEFAULT false,
    `played` INTEGER NOT NULL DEFAULT 0,
    `won` INTEGER NOT NULL DEFAULT 0,
    `lost` INTEGER NOT NULL DEFAULT 0,
    `caroms` INTEGER NOT NULL DEFAULT 0,
    `innings` INTEGER NOT NULL DEFAULT 0,
    `average` DOUBLE NULL,
    `highRun` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PlayerTournamentRecord_playerId_idx`(`playerId`),
    INDEX `PlayerTournamentRecord_isChampion_idx`(`isChampion`),
    UNIQUE INDEX `PlayerTournamentRecord_playerId_tournamentKey_key`(`playerId`, `tournamentKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Player_code_key` ON `Player`(`code`);

-- CreateIndex
CREATE INDEX `Player_documentId_idx` ON `Player`(`documentId`);

-- AddForeignKey
ALTER TABLE `PlayerTournamentRecord` ADD CONSTRAINT `PlayerTournamentRecord_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlayerTournamentRecord` ADD CONSTRAINT `PlayerTournamentRecord_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
