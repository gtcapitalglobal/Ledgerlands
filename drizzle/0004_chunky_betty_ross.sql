ALTER TABLE `contracts` MODIFY COLUMN `contractPrice` varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE `contracts` MODIFY COLUMN `costBasis` varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE `contracts` MODIFY COLUMN `downPayment` varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE `contracts` MODIFY COLUMN `installmentAmount` varchar(20);--> statement-breakpoint
ALTER TABLE `contracts` MODIFY COLUMN `balloonAmount` varchar(20);--> statement-breakpoint
ALTER TABLE `contracts` MODIFY COLUMN `openingReceivable` varchar(20);