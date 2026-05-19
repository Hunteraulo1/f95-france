ALTER TABLE "config"
DROP COLUMN IF EXISTS "auto_check_interval_minutes";

ALTER TABLE "config"
DROP COLUMN IF EXISTS "auto_check_reference_time";
