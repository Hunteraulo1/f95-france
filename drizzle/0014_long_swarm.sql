ALTER TABLE "config" RENAME COLUMN "discord_webhook_logs" TO "discord_webhook_admin";--> statement-breakpoint
ALTER TABLE "config" DROP COLUMN "discord_webhook_proofreaders";--> statement-breakpoint
ALTER TABLE "config" DROP COLUMN "auto_check_interval_minutes";--> statement-breakpoint
ALTER TABLE "config" DROP COLUMN "auto_check_reference_time";