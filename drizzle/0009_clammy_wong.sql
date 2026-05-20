ALTER TABLE `playerInvites` ADD `token` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `playerInvites` ADD `tokenExpiresAt` timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE `playerInvites` ADD CONSTRAINT `playerInvites_token_unique` UNIQUE(`token`);