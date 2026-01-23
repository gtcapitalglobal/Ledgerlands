ALTER TABLE `contractAttachments` ADD `propertyId` varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE `contractAttachments` ADD `docType` enum('Contract','Notice','Deed','Assignment','Other') DEFAULT 'Other' NOT NULL;--> statement-breakpoint
ALTER TABLE `contractAttachments` ADD `uploadedBy` varchar(255) DEFAULT 'System' NOT NULL;