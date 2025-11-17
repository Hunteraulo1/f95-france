CREATE TABLE `api_log` (
    `id` varchar(255) NOT NULL DEFAULT(UUID()),
    `user_id` varchar(255),
    `method` varchar(16) NOT NULL,
    `route` varchar(255) NOT NULL,
    `status` int NOT NULL,
    `payload` text,
    `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `api_log_id` PRIMARY KEY (`id`)
);
--> statement-breakpoint
ALTER TABLE `api_log`
ADD CONSTRAINT `api_log_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
