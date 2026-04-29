ALTER TABLE "config"
ADD COLUMN IF NOT EXISTS "auto_check_interval_minutes" integer NOT NULL DEFAULT 360,
ADD COLUMN IF NOT EXISTS "auto_check_last_run_at" timestamp;
