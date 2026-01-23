CREATE TABLE `taxAuditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('CONTRACT','PAYMENT') NOT NULL,
	`entityId` int NOT NULL,
	`field` varchar(100) NOT NULL,
	`oldValue` text,
	`newValue` text,
	`changedBy` varchar(255) NOT NULL,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	`reason` text NOT NULL,
	CONSTRAINT `taxAuditLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contracts` ADD `costBasisSource` enum('HUD','PSA','ASSIGNMENT','LEGACY','OTHER');--> statement-breakpoint
ALTER TABLE `contracts` ADD `costBasisNotes` text;--> statement-breakpoint
ALTER TABLE `contracts` ADD `openingReceivableSource` enum('ASSIGNMENT','LEGACY','OTHER');