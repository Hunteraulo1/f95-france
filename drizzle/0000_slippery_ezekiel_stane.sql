CREATE TABLE `api_key` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`key_hash` varchar(64) NOT NULL,
	`key_prefix` varchar(32) NOT NULL,
	`label` varchar(255) NOT NULL DEFAULT '',
	`kind` varchar(16) NOT NULL DEFAULT 'bearer',
	`requests_per_minute` int NOT NULL DEFAULT 60,
	`expires_at` datetime,
	`revoked_at` datetime,
	`last_used_at` datetime,
	`total_request_count` int NOT NULL DEFAULT 0,
	`owner_user_id` varchar(255) NOT NULL,
	`created_by_user_id` varchar(255),
	`created_at` datetime NOT NULL DEFAULT (NOW()),
	`updated_at` datetime NOT NULL DEFAULT (NOW()),
	CONSTRAINT `api_key_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_key_key_hash_unique` UNIQUE(`key_hash`)
);
--> statement-breakpoint
CREATE TABLE `api_key_rate` (
	`api_key_id` varchar(255) NOT NULL,
	`request_count` int NOT NULL DEFAULT 0,
	`window_started_at` datetime NOT NULL DEFAULT (NOW()),
	CONSTRAINT `api_key_rate_api_key_id` PRIMARY KEY(`api_key_id`)
);
--> statement-breakpoint
CREATE TABLE `api_log` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255),
	`method` varchar(16) NOT NULL,
	`route` text NOT NULL,
	`status` int NOT NULL,
	`ip_address` varchar(64),
	`payload` text,
	`error_message` text,
	`created_at` datetime NOT NULL DEFAULT (NOW()),
	CONSTRAINT `api_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `app_log` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`level` varchar(16) NOT NULL,
	`source` varchar(64) NOT NULL,
	`message` text NOT NULL,
	`meta` text,
	`created_at` datetime NOT NULL DEFAULT (NOW()),
	CONSTRAINT `app_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `app_permission` (
	`key` varchar(64) NOT NULL,
	`label` varchar(255) NOT NULL,
	`description` text,
	`group` varchar(64),
	CONSTRAINT `app_permission_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `app_role` (
	`slug` varchar(64) NOT NULL,
	`label` varchar(255) NOT NULL,
	`description` text,
	`edit_mode` varchar(32) NOT NULL DEFAULT 'direct',
	`badge_style` varchar(32) NOT NULL DEFAULT 'default',
	`staff` boolean NOT NULL DEFAULT false,
	`priority` int NOT NULL DEFAULT 0,
	`max_api_keys` int NOT NULL DEFAULT 3,
	`is_system` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT (NOW()),
	`updated_at` datetime NOT NULL DEFAULT (NOW()),
	CONSTRAINT `app_role_slug` PRIMARY KEY(`slug`)
);
--> statement-breakpoint
CREATE TABLE `app_role_permission` (
	`role_slug` varchar(64) NOT NULL,
	`permission_key` varchar(64) NOT NULL,
	CONSTRAINT `app_role_permission_role_slug_permission_key_pk` PRIMARY KEY(`role_slug`,`permission_key`)
);
--> statement-breakpoint
CREATE TABLE `config` (
	`id` varchar(255) NOT NULL DEFAULT 'main',
	`app_name` varchar(255) NOT NULL DEFAULT 'F95 France',
	`google_spreadsheet_id` varchar(255),
	`google_oauth_access_token` text,
	`google_oauth_refresh_token` text,
	`google_oauth_token_expiry` datetime,
	`auto_check_last_run_at` datetime,
	`maintenance_mode` boolean NOT NULL DEFAULT false,
	`updated_at` datetime NOT NULL DEFAULT (NOW()),
	CONSTRAINT `config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_verification_token` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` datetime NOT NULL DEFAULT (NOW()),
	CONSTRAINT `email_verification_token_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`name` varchar(255) NOT NULL,
	`tags` text NOT NULL,
	`image` varchar(500) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT (NOW()),
	`updated_at` datetime NOT NULL DEFAULT (NOW()),
	`description` text,
	`description_fr` text,
	`website` varchar(32) NOT NULL DEFAULT 'f95z',
	`thread_id` int,
	`link` varchar(500) NOT NULL DEFAULT '',
	`game_auto_check` boolean NOT NULL DEFAULT true,
	`game_version` varchar(100),
	CONSTRAINT `game_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game_translation` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`game_id` varchar(255) NOT NULL,
	`translation_name` varchar(255),
	`version` varchar(100),
	`status` varchar(32) NOT NULL,
	`tversion` varchar(100) NOT NULL,
	`tlink` text NOT NULL,
	`tname` varchar(64) NOT NULL DEFAULT 'no_translation',
	`traductor_id` varchar(255),
	`translator_alerts_enabled` boolean NOT NULL DEFAULT true,
	`proofreader_id` varchar(255),
	`ttype` varchar(32) NOT NULL,
	`game_type` varchar(32) NOT NULL DEFAULT 'other',
	`ac` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT (NOW()),
	`updated_at` datetime NOT NULL DEFAULT (NOW()),
	CONSTRAINT `game_translation_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `login_throttle` (
	`client_key` varchar(128) NOT NULL,
	`failed_count` int NOT NULL DEFAULT 0,
	`window_started_at` datetime NOT NULL DEFAULT (NOW()),
	`locked_until` datetime,
	CONSTRAINT `login_throttle_client_key` PRIMARY KEY(`client_key`)
);
--> statement-breakpoint
CREATE TABLE `notification` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255) NOT NULL,
	`type` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`read` boolean NOT NULL DEFAULT false,
	`link` varchar(500),
	`metadata` text,
	`created_at` datetime NOT NULL DEFAULT (NOW()),
	CONSTRAINT `notification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `passkey` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255) NOT NULL,
	`credential_id` text NOT NULL,
	`public_key` text NOT NULL,
	`counter` int NOT NULL DEFAULT 0,
	`transports` text,
	`created_at` datetime NOT NULL DEFAULT (NOW()),
	`last_used_at` datetime,
	CONSTRAINT `passkey_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `passkey_challenge` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255),
	`type` varchar(32) NOT NULL,
	`challenge` text NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` datetime NOT NULL DEFAULT (NOW()),
	CONSTRAINT `passkey_challenge_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `password_reset_token` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255) NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` datetime NOT NULL DEFAULT (NOW()),
	CONSTRAINT `password_reset_token_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(255) NOT NULL,
	`secret_hash` varchar(64) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`expires_at` datetime NOT NULL,
	CONSTRAINT `session_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `submission` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255) NOT NULL,
	`opened_by_user_id` varchar(255),
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`game_id` varchar(255),
	`translation_id` varchar(255),
	`type` varchar(32) NOT NULL,
	`data` text NOT NULL,
	`admin_notes` text,
	`created_at` datetime NOT NULL DEFAULT (NOW()),
	`updated_at` datetime NOT NULL DEFAULT (NOW()),
	CONSTRAINT `submission_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `translator` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`name` varchar(255) NOT NULL,
	`user_id` varchar(255),
	`pages` text NOT NULL,
	`discord_id` varchar(255),
	`created_at` datetime NOT NULL DEFAULT (NOW()),
	`updated_at` datetime NOT NULL DEFAULT (NOW()),
	CONSTRAINT `translator_id` PRIMARY KEY(`id`),
	CONSTRAINT `translator_name_unique` UNIQUE(`name`),
	CONSTRAINT `translator_discord_id_unique` UNIQUE(`discord_id`)
);
--> statement-breakpoint
CREATE TABLE `update` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`game_id` varchar(255) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'update',
	`created_at` datetime NOT NULL DEFAULT (NOW()),
	`updated_at` datetime NOT NULL DEFAULT (NOW()),
	CONSTRAINT `update_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `update_history` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`update_id` varchar(255) NOT NULL,
	`user_id` varchar(255),
	`action` varchar(32) NOT NULL,
	`changes` text,
	`created_at` datetime NOT NULL DEFAULT (NOW()),
	CONSTRAINT `update_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`username` varchar(32) NOT NULL,
	`discord_id` varchar(255),
	`avatar` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`has_password` boolean NOT NULL DEFAULT true,
	`two_factor_enabled` boolean NOT NULL DEFAULT false,
	`two_factor_secret` text,
	`role` varchar(255) NOT NULL DEFAULT 'user',
	`theme` enum('system','light','dark') DEFAULT 'system',
	`direct_mode` boolean NOT NULL DEFAULT true,
	`dev_user_id` varchar(255),
	`game_add` int NOT NULL DEFAULT 0,
	`game_edit` int NOT NULL DEFAULT 0,
	`profile_bio` text,
	`profile_background_url` varchar(2048),
	`profile_music_url` varchar(2048),
	`profile_cursor_url` varchar(2048),
	`saved_games_filters` text NOT NULL DEFAULT ('[]'),
	`saved_updates_filters` text NOT NULL DEFAULT ('[]'),
	`email_verified_at` datetime,
	`email_unsubscribe_token` varchar(64) NOT NULL,
	`email_marketing_opt_out` boolean NOT NULL DEFAULT false,
	`last_seen_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (NOW()),
	`updated_at` datetime NOT NULL DEFAULT (NOW()),
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`),
	CONSTRAINT `user_username_unique` UNIQUE(`username`),
	CONSTRAINT `user_discord_id_unique` UNIQUE(`discord_id`),
	CONSTRAINT `user_email_unsubscribe_token_unique` UNIQUE(`email_unsubscribe_token`)
);
--> statement-breakpoint
ALTER TABLE `api_key` ADD CONSTRAINT `api_key_owner_user_id_user_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `api_key` ADD CONSTRAINT `api_key_created_by_user_id_user_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `api_key_rate` ADD CONSTRAINT `api_key_rate_api_key_id_api_key_id_fk` FOREIGN KEY (`api_key_id`) REFERENCES `api_key`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `api_log` ADD CONSTRAINT `api_log_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `app_role_permission` ADD CONSTRAINT `app_role_permission_role_slug_app_role_slug_fk` FOREIGN KEY (`role_slug`) REFERENCES `app_role`(`slug`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `app_role_permission` ADD CONSTRAINT `app_role_permission_permission_key_app_permission_key_fk` FOREIGN KEY (`permission_key`) REFERENCES `app_permission`(`key`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_verification_token` ADD CONSTRAINT `email_verification_token_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `game_translation` ADD CONSTRAINT `game_translation_game_id_game_id_fk` FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification` ADD CONSTRAINT `notification_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `passkey` ADD CONSTRAINT `passkey_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `passkey_challenge` ADD CONSTRAINT `passkey_challenge_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `password_reset_token` ADD CONSTRAINT `password_reset_token_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `submission` ADD CONSTRAINT `submission_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `submission` ADD CONSTRAINT `submission_opened_by_user_id_user_id_fk` FOREIGN KEY (`opened_by_user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `submission` ADD CONSTRAINT `submission_game_id_game_id_fk` FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `submission` ADD CONSTRAINT `submission_translation_id_game_translation_id_fk` FOREIGN KEY (`translation_id`) REFERENCES `game_translation`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `translator` ADD CONSTRAINT `translator_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `update` ADD CONSTRAINT `update_game_id_game_id_fk` FOREIGN KEY (`game_id`) REFERENCES `game`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `update_history` ADD CONSTRAINT `update_history_update_id_update_id_fk` FOREIGN KEY (`update_id`) REFERENCES `update`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `update_history` ADD CONSTRAINT `update_history_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE cascade;