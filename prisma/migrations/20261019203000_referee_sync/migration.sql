-- Sesiones y eventos de la tablet de arbitraje. No modifica partidos existentes.
CREATE TABLE `RefereeSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RefereeSession_tokenHash_key`(`tokenHash`),
    INDEX `RefereeSession_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RefereeSync` (
    `matchId` VARCHAR(191) NOT NULL,
    `baseline` LONGTEXT NOT NULL,
    `tableId` VARCHAR(191) NULL,
    `epoch` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`matchId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RefereeEvent` (
    `id` VARCHAR(191) NOT NULL,
    `matchId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `epoch` INTEGER NOT NULL DEFAULT 1,
    `sequence` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `payload` TEXT NOT NULL,
    `clientTime` DATETIME(3) NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RefereeEvent_matchId_epoch_sequence_key`(`matchId`, `epoch`, `sequence`),
    INDEX `RefereeEvent_matchId_epoch_idx`(`matchId`, `epoch`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `RefereeSession` ADD CONSTRAINT `RefereeSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RefereeSync` ADD CONSTRAINT `RefereeSync_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RefereeEvent` ADD CONSTRAINT `RefereeEvent_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
