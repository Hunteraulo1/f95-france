ALTER TABLE "game_translation" ADD COLUMN "game_type" varchar(32) DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "game" DROP COLUMN "type";