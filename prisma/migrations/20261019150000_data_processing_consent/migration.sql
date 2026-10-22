-- AlterTable
ALTER TABLE `User` ADD COLUMN `dataProcessingAcceptedAt` DATETIME(3) NULL,
    ADD COLUMN `dataProcessingVersion` VARCHAR(191) NULL;
