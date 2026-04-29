ALTER TABLE "config"
ADD COLUMN IF NOT EXISTS "auto_check_reference_time" varchar(5) NOT NULL DEFAULT '00:00';
