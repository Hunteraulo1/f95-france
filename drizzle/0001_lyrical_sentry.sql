CREATE INDEX `submission_status_idx` ON `submission` (`status`);--> statement-breakpoint
CREATE INDEX `submission_user_id_status_idx` ON `submission` (`user_id`,`status`);