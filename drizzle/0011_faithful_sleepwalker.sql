DROP TABLE `monthlyFees`;--> statement-breakpoint
DROP TABLE `playerDebts`;--> statement-breakpoint
ALTER TABLE `appSettings` DROP COLUMN `monthlyFeeCents`;--> statement-breakpoint
ALTER TABLE `appSettings` DROP COLUMN `yellowCardFineCents`;--> statement-breakpoint
ALTER TABLE `appSettings` DROP COLUMN `redCardFineCents`;--> statement-breakpoint
ALTER TABLE `appSettings` DROP COLUMN `noShowFineCents`;--> statement-breakpoint
ALTER TABLE `appSettings` DROP COLUMN `enableMonthlyFee`;--> statement-breakpoint
ALTER TABLE `appSettings` DROP COLUMN `enableYellowCardFine`;--> statement-breakpoint
ALTER TABLE `appSettings` DROP COLUMN `enableRedCardFine`;--> statement-breakpoint
ALTER TABLE `appSettings` DROP COLUMN `enableNoShowFine`;