CREATE TABLE `regulationAcceptances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`acceptedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `regulationAcceptances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `regulationAcceptances` ADD CONSTRAINT `regulationAcceptances_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;