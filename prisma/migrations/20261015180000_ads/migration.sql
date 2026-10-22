-- CreateTable
CREATE TABLE `Ad` (
    `id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NULL,
    `href` VARCHAR(191) NULL,
    `imageMime` VARCHAR(191) NULL,
    `imageData` MEDIUMBLOB NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
