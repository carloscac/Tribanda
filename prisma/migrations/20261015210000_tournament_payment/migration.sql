-- AlterTable
ALTER TABLE `Tournament` ADD COLUMN `paymentMethod` VARCHAR(32) NULL;
ALTER TABLE `Tournament` ADD COLUMN `paymentAccount` VARCHAR(128) NULL;
ALTER TABLE `Tournament` ADD COLUMN `paymentNote` VARCHAR(512) NULL;
