CREATE TABLE `translator_application` (
	`id` varchar(255) NOT NULL DEFAULT (UUID()),
	`user_id` varchar(255) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`explanation` text,
	`claimed_translator_id` varchar(255),
	`reviewed_by_user_id` varchar(255),
	`admin_notes` text,
	`created_at` datetime NOT NULL DEFAULT (NOW()),
	`updated_at` datetime NOT NULL DEFAULT (NOW()),
	CONSTRAINT `translator_application_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `translator_application` ADD CONSTRAINT `translator_application_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `translator_application` ADD CONSTRAINT `translator_application_claimed_translator_id_translator_id_fk` FOREIGN KEY (`claimed_translator_id`) REFERENCES `translator`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `translator_application` ADD CONSTRAINT `translator_application_reviewed_by_user_id_user_id_fk` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `translator_application_status_idx` ON `translator_application` (`status`);--> statement-breakpoint
CREATE INDEX `translator_application_user_id_idx` ON `translator_application` (`user_id`);