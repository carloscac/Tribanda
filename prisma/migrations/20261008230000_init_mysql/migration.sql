-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'ORGANIZER',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_documentId_key`(`documentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `distance` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Category_userId_name_key`(`userId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Player` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `alias` VARCHAR(191) NULL,
    `documentId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `club` VARCHAR(191) NULL,
    `photoUrl` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Player_userId_email_idx`(`userId`, `email`),
    INDEX `Player_userId_documentId_idx`(`userId`, `documentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tournament` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `venue` VARCHAR(191) NULL,
    `date` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `mix` VARCHAR(191) NOT NULL DEFAULT 'MIXED',
    `singleCategoryId` VARCHAR(191) NULL,
    `equalInnings` BOOLEAN NOT NULL DEFAULT true,
    `requireInnings` BOOLEAN NOT NULL DEFAULT false,
    `maxInnings` INTEGER NULL,
    `tableCount` INTEGER NOT NULL DEFAULT 4,
    `groupSize` INTEGER NOT NULL DEFAULT 4,
    `plannedCapacity` INTEGER NULL,
    `groupsFinalized` BOOLEAN NOT NULL DEFAULT false,
    `qualifyPerGroup` INTEGER NOT NULL DEFAULT 2,
    `knockoutLayout` VARCHAR(191) NOT NULL DEFAULT 'COLUMNS',
    `knockoutFillMode` VARCHAR(191) NOT NULL DEFAULT 'AUTO',
    `knockoutDrawMode` VARCHAR(191) NOT NULL DEFAULT 'FIXED',
    `knockoutPreDraw` BOOLEAN NOT NULL DEFAULT false,
    `knockoutFirstRoundPairing` VARCHAR(191) NOT NULL DEFAULT 'CROSS_GROUP_SEED',
    `participantScreens` VARCHAR(191) NOT NULL DEFAULT '{"inicio":true,"grupos":true,"cuadro":true,"mesas":true,"stats":true,"tv":true}',
    `prizeChampion` BOOLEAN NOT NULL DEFAULT true,
    `prizeHighRun` BOOLEAN NOT NULL DEFAULT true,
    `prizeBestAverage` BOOLEAN NOT NULL DEFAULT true,
    `entryFee` INTEGER NULL,
    `prizePoolPercent` INTEGER NULL,
    `prizeShareMode` VARCHAR(191) NOT NULL DEFAULT 'FIXED',
    `repescaFee` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Tournament_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TournamentPrize` (
    `id` VARCHAR(191) NOT NULL,
    `tournamentId` VARCHAR(191) NOT NULL,
    `place` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL,
    `sharePercent` INTEGER NULL,

    UNIQUE INDEX `TournamentPrize_tournamentId_place_key`(`tournamentId`, `place`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Table` (
    `id` VARCHAR(191) NOT NULL,
    `tournamentId` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL,

    UNIQUE INDEX `Table_tournamentId_number_key`(`tournamentId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Inscription` (
    `id` VARCHAR(191) NOT NULL,
    `tournamentId` VARCHAR(191) NOT NULL,
    `playerId` VARCHAR(191) NOT NULL,
    `participantUserId` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NULL,
    `distance` INTEGER NOT NULL,
    `paid` BOOLEAN NOT NULL DEFAULT false,
    `checkedIn` BOOLEAN NOT NULL DEFAULT false,
    `koEligible` BOOLEAN NOT NULL DEFAULT false,
    `koManualPick` BOOLEAN NOT NULL DEFAULT false,
    `repescaOptIn` BOOLEAN NULL,
    `repescaFeePaid` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Inscription_participantUserId_idx`(`participantUserId`),
    UNIQUE INDEX `Inscription_tournamentId_playerId_key`(`tournamentId`, `playerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tournamentId` VARCHAR(191) NULL,
    `inscriptionId` VARCHAR(191) NULL,
    `matchId` VARCHAR(191) NULL,
    `kind` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NOT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_readAt_idx`(`userId`, `readAt`),
    INDEX `Notification_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Group` (
    `id` VARCHAR(191) NOT NULL,
    `tournamentId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `maxMembers` INTEGER NOT NULL DEFAULT 4,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `tiebreakNote` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupMember` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `inscriptionId` VARCHAR(191) NOT NULL,
    `seed` INTEGER NULL,
    `qualified` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `GroupMember_groupId_inscriptionId_key`(`groupId`, `inscriptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Match` (
    `id` VARCHAR(191) NOT NULL,
    `tournamentId` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NULL,
    `phase` VARCHAR(191) NOT NULL DEFAULT 'GROUP',
    `playInKind` VARCHAR(191) NULL,
    `round` INTEGER NOT NULL DEFAULT 0,
    `bracketSlot` INTEGER NULL,
    `nextMatchId` VARCHAR(191) NULL,
    `nextSide` VARCHAR(191) NULL,
    `sideAId` VARCHAR(191) NULL,
    `sideBId` VARCHAR(191) NULL,
    `sideAGroupOrder` INTEGER NULL,
    `sideAPlace` INTEGER NULL,
    `sideBGroupOrder` INTEGER NULL,
    `sideBPlace` INTEGER NULL,
    `distanceA` INTEGER NOT NULL,
    `distanceB` INTEGER NOT NULL,
    `caromsA` INTEGER NULL,
    `caromsB` INTEGER NULL,
    `innings` INTEGER NULL,
    `highRunA` INTEGER NULL,
    `highRunB` INTEGER NULL,
    `tableId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'SCHEDULED',
    `winnerId` VARCHAR(191) NULL,
    `closeReason` VARCHAR(191) NULL,
    `paused` BOOLEAN NOT NULL DEFAULT false,
    `liveStartedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MatchVisit` (
    `id` VARCHAR(191) NOT NULL,
    `matchId` VARCHAR(191) NOT NULL,
    `inning` INTEGER NOT NULL,
    `side` VARCHAR(191) NOT NULL,
    `caroms` INTEGER NOT NULL DEFAULT 0,
    `endedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Player` ADD CONSTRAINT `Player_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Player` ADD CONSTRAINT `Player_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tournament` ADD CONSTRAINT `Tournament_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentPrize` ADD CONSTRAINT `TournamentPrize_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Table` ADD CONSTRAINT `Table_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inscription` ADD CONSTRAINT `Inscription_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inscription` ADD CONSTRAINT `Inscription_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inscription` ADD CONSTRAINT `Inscription_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_inscriptionId_fkey` FOREIGN KEY (`inscriptionId`) REFERENCES `Inscription`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Group` ADD CONSTRAINT `Group_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_inscriptionId_fkey` FOREIGN KEY (`inscriptionId`) REFERENCES `Inscription`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_sideAId_fkey` FOREIGN KEY (`sideAId`) REFERENCES `Inscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_sideBId_fkey` FOREIGN KEY (`sideBId`) REFERENCES `Inscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `Table`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Match` ADD CONSTRAINT `Match_winnerId_fkey` FOREIGN KEY (`winnerId`) REFERENCES `Inscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MatchVisit` ADD CONSTRAINT `MatchVisit_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
