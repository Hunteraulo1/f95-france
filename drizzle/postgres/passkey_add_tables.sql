CREATE TABLE IF NOT EXISTS "passkey" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer NOT NULL DEFAULT 0,
	"transports" text,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"last_used_at" timestamp
);

CREATE TABLE IF NOT EXISTS "passkey_challenge" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255),
	"type" varchar(32) NOT NULL,
	"challenge" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL DEFAULT now()
);

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'passkey_user_id_user_id_fk'
	) THEN
		ALTER TABLE "passkey"
		ADD CONSTRAINT "passkey_user_id_user_id_fk"
		FOREIGN KEY ("user_id") REFERENCES "user"("id")
		ON DELETE CASCADE ON UPDATE CASCADE;
	END IF;
END $$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'passkey_challenge_user_id_user_id_fk'
	) THEN
		ALTER TABLE "passkey_challenge"
		ADD CONSTRAINT "passkey_challenge_user_id_user_id_fk"
		FOREIGN KEY ("user_id") REFERENCES "user"("id")
		ON DELETE CASCADE ON UPDATE CASCADE;
	END IF;
END $$;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_indexes
		WHERE schemaname = 'public'
		  AND indexname = 'passkey_credential_id_unique'
	) THEN
		CREATE UNIQUE INDEX "passkey_credential_id_unique" ON "passkey" ("credential_id");
	END IF;
END $$;
