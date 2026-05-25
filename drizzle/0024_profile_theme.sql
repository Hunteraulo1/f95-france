ALTER TABLE "user" DROP COLUMN IF EXISTS "profile_links";
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "profile_background_url" varchar(2048);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "profile_music_url" varchar(2048);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "profile_cursor_url" varchar(2048);
--> statement-breakpoint
UPDATE app_permission
SET
    description = 'Personnaliser son profil (bio, fond, musique, curseur)'
WHERE
    key = 'profile.customize';
