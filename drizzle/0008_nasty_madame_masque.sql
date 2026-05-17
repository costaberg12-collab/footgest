CREATE TABLE `playerInvites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(160) NOT NULL,
	`phone` varchar(32),
	`type` enum('line','goalkeeper','both') NOT NULL DEFAULT 'line',
	`monthlyFeeCents` int NOT NULL DEFAULT 0,
	`isMonthlyMember` boolean NOT NULL DEFAULT true,
	`isRefereeAuthorized` boolean NOT NULL DEFAULT false,
	`invitedBy` int NOT NULL,
	`status` enum('pending','accepted','declined') NOT NULL DEFAULT 'pending',
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `playerInvites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `playerInvites` ADD CONSTRAINT `playerInvites_invitedBy_users_id_fk` FOREIGN KEY (`invitedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;