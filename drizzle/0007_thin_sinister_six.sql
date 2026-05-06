ALTER TABLE "api_key"
ADD COLUMN IF NOT EXISTS "kind" varchar(16) DEFAULT 'bearer' NOT NULL;
