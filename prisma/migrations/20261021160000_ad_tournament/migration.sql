-- AlterTable
ALTER TABLE `Ad` ADD COLUMN `tournamentId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Ad_tournamentId_idx` ON `Ad`(`tournamentId`);

-- AddForeignKey
ALTER TABLE `Ad` ADD CONSTRAINT `Ad_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
