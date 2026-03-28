CREATE TABLE `notification` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255) NOT NULL,
	`type` enum('submission_status_changed','new_user_registered','submission_accepted','submission_rejected') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`read` boolean NOT NULL DEFAULT false,
	`link` varchar(500),
	`metadata` text,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `notification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `game_translation` MODIFY COLUMN `tname` enum('no_translation','integrated','translation','translation_with_mods') NOT NULL DEFAULT 'no_translation';--> statement-breakpoint
ALTER TABLE `notification` ADD CONSTRAINT `notification_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE cascade;