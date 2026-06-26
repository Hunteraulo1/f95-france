CREATE TABLE `extension_link_code` (
	`code` varchar(16) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`expires_at` datetime NOT NULL,
	`used_at` datetime,
	`created_at` datetime NOT NULL DEFAULT (NOW()),
	CONSTRAINT `extension_link_code_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
ALTER TABLE `extension_link_code` ADD CONSTRAINT `extension_link_code_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE cascade;