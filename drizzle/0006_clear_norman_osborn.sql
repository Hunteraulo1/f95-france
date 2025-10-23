ALTER TABLE `game_translations` ADD `link` varchar(500) NOT NULL;--> statement-breakpoint
ALTER TABLE `game_translations` ADD `website` enum('F95z','LewdCorner','Autre') NOT NULL;--> statement-breakpoint
ALTER TABLE `game_translations` ADD `thread_id` int;--> statement-breakpoint
ALTER TABLE `game_translations` ADD `status` enum('in_progress','completed','abandoned') NOT NULL;--> statement-breakpoint
ALTER TABLE `games` DROP COLUMN `website`;--> statement-breakpoint
ALTER TABLE `games` DROP COLUMN `link`;--> statement-breakpoint
ALTER TABLE `games` DROP COLUMN `thread_id`;--> statement-breakpoint
ALTER TABLE `games` DROP COLUMN `status`;