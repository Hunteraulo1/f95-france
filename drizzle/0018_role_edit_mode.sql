ALTER TABLE "app_role"
ADD COLUMN IF NOT EXISTS "edit_mode" varchar(32) DEFAULT 'direct' NOT NULL;
--> statement-breakpoint
UPDATE "app_role"
SET
    "edit_mode" = 'submission'
WHERE
    "slug" = 'translator';
--> statement-breakpoint
UPDATE "app_role" SET "edit_mode" = 'direct' WHERE "slug" = 'admin';
--> statement-breakpoint
UPDATE "app_role"
SET
    "edit_mode" = 'user_direct_mode'
WHERE
    "slug" = 'superadmin';
--> statement-breakpoint
UPDATE "app_role" SET "edit_mode" = 'direct' WHERE "slug" = 'user';
