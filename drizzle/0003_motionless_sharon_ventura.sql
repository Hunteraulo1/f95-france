CREATE TABLE `auto_check_run` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`trigger_source` varchar(32) NOT NULL,
	`status` varchar(32) NOT NULL,
	`scanned_games` int NOT NULL DEFAULT 0,
	`updated_games` int NOT NULL DEFAULT 0,
	`updated_translations` int NOT NULL DEFAULT 0,
	`aligned_games` int NOT NULL DEFAULT 0,
	`translator_webhooks_sent` int NOT NULL DEFAULT 0,
	`proofreader_webhooks_sent` int NOT NULL DEFAULT 0,
	`issue_count` int NOT NULL DEFAULT 0,
	`duration_ms` int,
	`fatal_error` text,
	`started_at` datetime NOT NULL DEFAULT (NOW()),
	`finished_at` datetime,
	CONSTRAINT `auto_check_run_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auto_check_run_item` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`run_id` varchar(255) NOT NULL,
	`kind` varchar(32) NOT NULL,
	`game_id` varchar(255),
	`game_name` varchar(512),
	`translation_id` varchar(255),
	`translation_name` varchar(255),
	`thread_id` int,
	`old_version` varchar(128),
	`new_version` varchar(128),
	`stage` varchar(64),
	`message` text,
	`detail` text,
	CONSTRAINT `auto_check_run_item_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `auto_check_run_item` ADD CONSTRAINT `auto_check_run_item_run_id_auto_check_run_id_fk` FOREIGN KEY (`run_id`) REFERENCES `auto_check_run`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auto_check_run_item` ADD CONSTRAINT `auto_check_run_item_game_id_game_id_fk` FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auto_check_run_item` ADD CONSTRAINT `auto_check_run_item_translation_id_game_translation_id_fk` FOREIGN KEY (`translation_id`) REFERENCES `game_translation`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `auto_check_run_started_at_idx` ON `auto_check_run` (`started_at`);--> statement-breakpoint
CREATE INDEX `auto_check_run_item_run_id_idx` ON `auto_check_run_item` (`run_id`);