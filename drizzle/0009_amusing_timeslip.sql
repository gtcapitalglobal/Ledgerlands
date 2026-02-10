CREATE TABLE `installments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contractId` int NOT NULL,
	`propertyId` varchar(50) NOT NULL,
	`installmentNumber` int NOT NULL,
	`dueDate` date NOT NULL,
	`amount` decimal(15,2) NOT NULL,
	`type` enum('REGULAR','BALLOON','DOWN_PAYMENT') NOT NULL DEFAULT 'REGULAR',
	`status` enum('PENDING','PAID','OVERDUE','PARTIAL') NOT NULL DEFAULT 'PENDING',
	`paidDate` date,
	`paidAmount` decimal(15,2),
	`paymentId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `installments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contracts` ADD `firstInstallmentDate` date;