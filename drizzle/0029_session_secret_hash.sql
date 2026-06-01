-- Invalide les sessions existantes (secret cookie jamais vérifié auparavant).
DELETE FROM "session";
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "secret_hash" varchar(64);
--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "secret_hash" SET NOT NULL;
