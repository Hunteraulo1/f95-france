ALTER TABLE "app_role" ADD COLUMN IF NOT EXISTS "badge_style" varchar(32) DEFAULT 'default' NOT NULL;

UPDATE "app_role" SET "badge_style" = 'superadmin' WHERE "slug" = 'superadmin';
UPDATE "app_role" SET "badge_style" = 'primary' WHERE "slug" = 'admin';
UPDATE "app_role" SET "badge_style" = 'secondary' WHERE "slug" = 'translator';
UPDATE "app_role" SET "badge_style" = 'default' WHERE "slug" = 'user';
