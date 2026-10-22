-- CreateTable
CREATE TABLE `AdSlide` (
    `id` VARCHAR(191) NOT NULL,
    `adId` VARCHAR(191) NOT NULL,
    `imageMime` VARCHAR(191) NOT NULL,
    `imageData` MEDIUMBLOB NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AdSlide_adId_idx` ON `AdSlide`(`adId`);

-- AddForeignKey
ALTER TABLE `AdSlide` ADD CONSTRAINT `AdSlide_adId_fkey` FOREIGN KEY (`adId`) REFERENCES `Ad`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
