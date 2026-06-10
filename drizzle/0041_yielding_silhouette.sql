ALTER TABLE "app_role" ADD COLUMN "max_api_keys" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
UPDATE "app_role" SET "max_api_keys" = 10 WHERE "slug" = 'admin';--> statement-breakpoint
UPDATE "app_role" SET "max_api_keys" = 50 WHERE "slug" = 'superadmin';
