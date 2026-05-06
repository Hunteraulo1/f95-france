ALTER TABLE "user" ADD COLUMN "discord_id" varchar(255);--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_discord_id_unique" UNIQUE("discord_id");