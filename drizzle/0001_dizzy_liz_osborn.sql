CREATE TABLE `submission` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255) NOT NULL,
	`status` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
	`game_id` varchar(255),
	`translation_id` varchar(255),
	`type` enum('game','translation','update','delete') NOT NULL,
	`data` text NOT NULL,
	`admin_notes` text,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `submission_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `theme` enum('system','light','dark') DEFAULT 'system';--> statement-breakpoint
ALTER TABLE `config` ADD `google_api_key` text;--> statement-breakpoint
ALTER TABLE `config` ADD `google_oauth_client_id` text;--> statement-breakpoint
ALTER TABLE `config` ADD `google_oauth_client_secret` text;--> statement-breakpoint
ALTER TABLE `config` ADD `google_oauth_access_token` text;--> statement-breakpoint
ALTER TABLE `config` ADD `google_oauth_refresh_token` text;--> statement-breakpoint
ALTER TABLE `config` ADD `google_oauth_token_expiry` datetime;--> statement-breakpoint
ALTER TABLE `user` ADD `direct_mode` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `submission` ADD CONSTRAINT `submission_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `submission` ADD CONSTRAINT `submission_game_id_game_id_fk` FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `submission` ADD CONSTRAINT `submission_translation_id_game_translation_id_fk` FOREIGN KEY (`translation_id`) REFERENCES `game_translation`(`id`) ON DELETE no action ON UPDATE no action;