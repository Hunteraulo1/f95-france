ALTER TABLE `user` ADD `email` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `avatar` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `role` varchar(255) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `theme` varchar(255) DEFAULT 'light' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `dev_user_id` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD `game_add` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `game_edit` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `created_at` datetime DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `updated_at` datetime DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD CONSTRAINT `user_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `age`;