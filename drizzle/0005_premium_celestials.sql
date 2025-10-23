ALTER TABLE `games` MODIFY COLUMN `status` enum('in_progress','completed','abandoned') NOT NULL;--> statement-breakpoint
ALTER TABLE `games` MODIFY COLUMN `type` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `games` DROP COLUMN `mobile`;--> statement-breakpoint
ALTER TABLE `games` DROP COLUMN `description`;