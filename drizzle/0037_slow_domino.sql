CREATE TABLE "app_log" (
	"id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" varchar(16) NOT NULL,
	"source" varchar(64) NOT NULL,
	"message" text NOT NULL,
	"meta" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "app_log_created_at_idx" ON "app_log" ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX "app_log_level_idx" ON "app_log" ("level");
--> statement-breakpoint
CREATE INDEX "app_log_source_idx" ON "app_log" ("source");
--> statement-breakpoint
ALTER TABLE "app_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_app_log" ON "app_log";
--> statement-breakpoint
CREATE POLICY "deny_all_app_log" ON "app_log" FOR ALL TO anon,
authenticated USING (false)
WITH
	CHECK (false);
