ALTER TABLE `game_translations` MODIFY COLUMN `website` enum('F95z','LewdCorner','Autre') NOT NULL;--> statement-breakpoint
ALTER TABLE `game_translations` MODIFY COLUMN `ttype` enum('auto','vf','manual','semi-auto','to_tested','hs') NOT NULL;--> statement-breakpoint
ALTER TABLE `games` MODIFY COLUMN `type` text NOT NULL;--> statement-breakpoint
ALTER TABLE `game_translations` ADD `mobile` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `games` ADD `description` text;