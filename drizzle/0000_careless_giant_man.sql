CREATE TABLE `config` (
	`id` varchar(255) NOT NULL DEFAULT 'main',
	`app_name` varchar(255) NOT NULL DEFAULT 'F95 France',
	`discord_webhook_updates` text,
	`discord_webhook_logs` text,
	`discord_webhook_translators` text,
	`discord_webhook_proofreaders` text,
	`google_spreadsheet_id` varchar(255),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`name` varchar(255) NOT NULL,
	`tags` text NOT NULL,
	`type` enum('renpy','rpgm','unity','unreal','flash','html','qsp','other') NOT NULL DEFAULT 'other',
	`image` varchar(500) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`description` text,
	`website` enum('f95z','lc','other') NOT NULL DEFAULT 'f95z',
	`thread_id` int,
	`link` varchar(500) NOT NULL DEFAULT '',
	CONSTRAINT `game_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game_translation` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`game_id` varchar(255) NOT NULL,
	`translation_name` varchar(255),
	`status` enum('in_progress','completed','abandoned') NOT NULL,
	`version` varchar(100) NOT NULL,
	`tversion` varchar(100) NOT NULL,
	`tlink` text NOT NULL,
	`tname` enum('no_translation','integrated','translation') NOT NULL DEFAULT 'no_translation',
	`traductor_id` varchar(255),
	`proofreader_id` varchar(255),
	`ttype` enum('auto','vf','manual','semi-auto','to_tested','hs') NOT NULL,
	`ac` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `game_translation_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`expires_at` datetime NOT NULL,
	CONSTRAINT `session_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `translator` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`name` varchar(255) NOT NULL,
	`user_id` varchar(255),
	`pages` text NOT NULL,
	`discord_id` varchar(255),
	`trad_count` int NOT NULL DEFAULT 0,
	`read_count` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `translator_id` PRIMARY KEY(`id`),
	CONSTRAINT `translator_name_unique` UNIQUE(`name`),
	CONSTRAINT `translator_discord_id_unique` UNIQUE(`discord_id`)
);
--> statement-breakpoint
CREATE TABLE `update` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`game_id` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `update_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`username` varchar(32) NOT NULL,
	`avatar` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` varchar(255) NOT NULL DEFAULT 'user',
	`theme` enum('light','dark') NOT NULL DEFAULT 'light',
	`dev_user_id` varchar(255),
	`game_add` int NOT NULL DEFAULT 0,
	`game_edit` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`),
	CONSTRAINT `user_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `game_translation` ADD CONSTRAINT `game_translation_game_id_game_id_fk` FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `translator` ADD CONSTRAINT `translator_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `update` ADD CONSTRAINT `update_game_id_game_id_fk` FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON DELETE no action ON UPDATE no action;