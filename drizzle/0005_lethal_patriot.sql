ALTER TABLE `api_key` MODIFY COLUMN `requests_per_minute` int NOT NULL DEFAULT 30;--> statement-breakpoint
ALTER TABLE `api_key` ADD `route_scope` varchar(64);