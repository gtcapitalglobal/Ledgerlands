CREATE TABLE `contractAttachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileType` varchar(50) NOT NULL,
	`fileSize` int,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contractAttachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contracts` RENAME COLUMN `type` TO `saleType`;--> statement-breakpoint
ALTER TABLE `contracts` MODIFY COLUMN `saleType` enum('CFD','CASH') NOT NULL DEFAULT 'CFD';--> statement-breakpoint
ALTER TABLE `contracts` MODIFY COLUMN `installmentAmount` decimal(15,2);--> statement-breakpoint
ALTER TABLE `contracts` MODIFY COLUMN `installmentCount` int;--> statement-breakpoint
ALTER TABLE `contracts` ADD `originType` enum('DIRECT','ASSUMED') NOT NULL;--> statement-breakpoint
ALTER TABLE `contracts` ADD `state` varchar(2) DEFAULT 'FL' NOT NULL;--> statement-breakpoint
ALTER TABLE `contracts` ADD `closeDate` date;--> statement-breakpoint
ALTER TABLE `contracts` DROP COLUMN `attachmentLinks`;