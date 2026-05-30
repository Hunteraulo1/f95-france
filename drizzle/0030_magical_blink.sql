ALTER TABLE "app_role" ADD COLUMN "staff" boolean DEFAULT false NOT NULL;

UPDATE "app_role" SET "staff" = true WHERE "slug" IN ('admin', 'superadmin');
