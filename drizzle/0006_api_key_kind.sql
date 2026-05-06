ALTER TABLE "api_key"
ADD COLUMN IF NOT EXISTS "kind" varchar(16) DEFAULT 'bearer' NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_key_session_per_owner" ON "public"."api_key" ("owner_user_id")
WHERE
    "kind" = 'session';
