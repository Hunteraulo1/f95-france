CREATE TABLE `game_translations` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`game_id` varchar(8) NOT NULL,
	`status` enum('in_progress','completed','abandoned') NOT NULL,
	`version` varchar(100) NOT NULL,
	`tversion` varchar(100) NOT NULL,
	`tlink` text NOT NULL,
	`traductor_id` varchar(255),
	`proofreader_id` varchar(255),
	`ttype` enum('auto','vf','manual','semi-auto','to_tested','hs') NOT NULL,
	`ac` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `game_translations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` varchar(8) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`tags` text NOT NULL,
	`type` text NOT NULL,
	`image` varchar(500) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`description` text,
	`website` enum('f95z','lc','other') NOT NULL DEFAULT 'f95z',
	`thread_id` int,
	`link` varchar(500) NOT NULL DEFAULT '',
	CONSTRAINT `games_id` PRIMARY KEY(`id`),
	CONSTRAINT `games_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`expires_at` datetime NOT NULL,
	CONSTRAINT `session_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `traductors` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`name` varchar(255) NOT NULL,
	`user_id` varchar(255),
	`pages` text NOT NULL,
	`discord_id` varchar(255),
	`trad_count` int NOT NULL DEFAULT 0,
	`read_count` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `traductors_id` PRIMARY KEY(`id`),
	CONSTRAINT `traductors_name_unique` UNIQUE(`name`),
	CONSTRAINT `traductors_discord_id_unique` UNIQUE(`discord_id`)
);
--> statement-breakpoint
CREATE TABLE `updates` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`game_id` varchar(8) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `updates_id` PRIMARY KEY(`id`)
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
ALTER TABLE `game_translations` ADD CONSTRAINT `game_translations_game_id_games_id_fk` FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `traductors` ADD CONSTRAINT `traductors_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `updates` ADD CONSTRAINT `updates_game_id_games_id_fk` FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON DELETE no action ON UPDATE no action;