ALTER TABLE `appSettings` MODIFY COLUMN `appName` varchar(80) NOT NULL DEFAULT 'Footgest';--> statement-breakpoint
ALTER TABLE `appSettings` ADD `teamName` varchar(80) DEFAULT 'Footbreja' NOT NULL;--> statement-breakpoint
ALTER TABLE `appSettings` ADD `monthlyFeeCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `appSettings` ADD `guestMonthlyFeeCents` int DEFAULT 0 NOT NULL;