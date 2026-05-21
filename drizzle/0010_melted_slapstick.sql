ALTER TABLE `appSettings` ADD `inviteCode` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `appSettings` ADD CONSTRAINT `appSettings_inviteCode_unique` UNIQUE(`inviteCode`);