ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "two_factor_secret" text;
