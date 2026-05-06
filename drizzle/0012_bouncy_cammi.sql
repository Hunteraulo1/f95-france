ALTER TABLE "api_key"
ADD COLUMN IF NOT EXISTS "total_request_count" integer DEFAULT 0 NOT NULL;
