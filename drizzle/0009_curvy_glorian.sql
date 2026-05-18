CREATE TABLE `monthlyFees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`playerId` int NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`amountCents` int NOT NULL,
	`isPaid` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`paidAt` timestamp,
	CONSTRAINT `monthlyFees_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `playerDebts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`playerId` int NOT NULL,
	`amountCents` int NOT NULL DEFAULT 0,
	`reason` varchar(255) NOT NULL,
	`type` enum('monthly_fee','yellow_card','red_card','no_show','other') NOT NULL,
	`isPaid` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`paidAt` timestamp,
	CONSTRAINT `playerDebts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `monthlyFees` ADD CONSTRAINT `monthlyFees_playerId_players_id_fk` FOREIGN KEY (`playerId`) REFERENCES `players`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `playerDebts` ADD CONSTRAINT `playerDebts_playerId_players_id_fk` FOREIGN KEY (`playerId`) REFERENCES `players`(`id`) ON DELETE no action ON UPDATE no action;