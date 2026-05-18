ALTER TABLE `appSettings` ADD `monthlyFeeCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `appSettings` ADD `yellowCardFineCents` int DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE `appSettings` ADD `redCardFineCents` int DEFAULT 5000 NOT NULL;--> statement-breakpoint
ALTER TABLE `appSettings` ADD `noShowFineCents` int DEFAULT 500 NOT NULL;--> statement-breakpoint
ALTER TABLE `appSettings` ADD `enableMonthlyFee` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `appSettings` ADD `enableYellowCardFine` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `appSettings` ADD `enableRedCardFine` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `appSettings` ADD `enableNoShowFine` boolean DEFAULT true NOT NULL;