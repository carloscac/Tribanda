-- AlterTable
ALTER TABLE `Player` ADD COLUMN `handicap` INTEGER NULL;

-- AlterTable
ALTER TABLE `Group` ADD COLUMN `tableId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `PlayerHandicapChange` (
    `id` VARCHAR(191) NOT NULL,
    `playerId` VARCHAR(191) NOT NULL,
    `previous` INTEGER NULL,
    `next` INTEGER NOT NULL,
    `reason` VARCHAR(191) NULL,
    `championships` INTEGER NOT NULL DEFAULT 0,
    `careerAverage` DOUBLE NULL,
    `changedByName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PlayerHandicapChange_playerId_idx`(`playerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PlayerHandicapChange` ADD CONSTRAINT `PlayerHandicapChange_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `Player`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Group` ADD CONSTRAINT `Group_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `Table`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
