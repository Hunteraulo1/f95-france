ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "discord_id" varchar(255);
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "user" ADD CONSTRAINT "user_discord_id_unique" UNIQUE("discord_id");
EXCEPTION
	WHEN duplicate_object THEN NULL;
	WHEN duplicate_table THEN NULL;
END $$;
