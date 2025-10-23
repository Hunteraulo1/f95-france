ALTER TABLE `game_translations` RENAME COLUMN `traductor` TO `traductor_id`;--> statement-breakpoint
ALTER TABLE `game_translations` RENAME COLUMN `proofreader` TO `proofreader_id`;--> statement-breakpoint
ALTER TABLE `game_translations` MODIFY COLUMN `traductor_id` varchar(255);--> statement-breakpoint
ALTER TABLE `game_translations` MODIFY COLUMN `proofreader_id` varchar(255);