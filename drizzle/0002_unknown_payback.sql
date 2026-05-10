CREATE TABLE `appSettings` (
	`id` int NOT NULL,
	`appName` varchar(80) NOT NULL DEFAULT 'FutGestão',
	`appDescription` text,
	`primaryColor` varchar(16) NOT NULL DEFAULT '#16a34a',
	`secondaryColor` varchar(16) NOT NULL DEFAULT '#0f172a',
	`logoUrl` text,
	`openingBalanceCents` int NOT NULL DEFAULT 0,
	`matchHour` int NOT NULL DEFAULT 20,
	`matchMinute` int NOT NULL DEFAULT 0,
	`confirmationHour` int NOT NULL DEFAULT 18,
	`confirmationMinute` int NOT NULL DEFAULT 0,
	`arrivalMinutesBefore` int NOT NULL DEFAULT 15,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `matches` ADD `arrivalQrToken` varchar(96);--> statement-breakpoint
ALTER TABLE `matches` ADD `arrivalQrExpiresAt` timestamp;