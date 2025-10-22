CREATE TABLE `game_translations` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`game_id` varchar(255) NOT NULL,
	`version` varchar(100) NOT NULL,
	`tversion` varchar(100) NOT NULL,
	`tlink` text NOT NULL,
	`traductor` text NOT NULL,
	`proofreader` text NOT NULL,
	`ttype` enum('Traduction Automatique','VO Française','Traduction Humaine','Traduction Semi-Automatique','À tester','Lien Trad HS') NOT NULL,
	`ac` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `game_translations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`website` enum('F95z','LewdCorner','Autre') NOT NULL,
	`link` varchar(500) NOT NULL,
	`thread_id` int,
	`name` varchar(255) NOT NULL,
	`status` enum('EN COURS','TERMINÉ','ABANDONNÉ') NOT NULL,
	`tags` text NOT NULL,
	`type` text NOT NULL,
	`image` varchar(500) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`mobile` boolean DEFAULT false,
	`description` text,
	CONSTRAINT `games_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `traductors` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`name` varchar(255) NOT NULL,
	`pages` text NOT NULL,
	`discord_id` int,
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
	`game_id` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `theme` enum('light','dark') NOT NULL DEFAULT 'light';--> statement-breakpoint
ALTER TABLE `game_translations` ADD CONSTRAINT `game_translations_game_id_games_id_fk` FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `updates` ADD CONSTRAINT `updates_game_id_games_id_fk` FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON DELETE no action ON UPDATE no action;