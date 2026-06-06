CREATE TABLE IF NOT EXISTS "email_verification_token" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "email_unsubscribe_token" varchar(64);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "email_marketing_opt_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "user" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;--> statement-breakpoint
UPDATE "user" SET "email_unsubscribe_token" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') WHERE "email_unsubscribe_token" IS NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "email_unsubscribe_token" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_verification_token" ADD CONSTRAINT "email_verification_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user" ADD CONSTRAINT "user_email_unsubscribe_token_unique" UNIQUE("email_unsubscribe_token");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
