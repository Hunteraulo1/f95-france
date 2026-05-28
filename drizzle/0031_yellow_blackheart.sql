ALTER TABLE "app_role" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;

UPDATE "app_role" SET "priority" = 100 WHERE "slug" = 'superadmin';
UPDATE "app_role" SET "priority" = 80 WHERE "slug" = 'admin';
UPDATE "app_role" SET "priority" = 40 WHERE "slug" = 'translator';
UPDATE "app_role" SET "priority" = 0 WHERE "slug" = 'user';
