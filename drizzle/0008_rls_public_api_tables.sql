ALTER TABLE "api_key" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "api_key_rate" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "login_throttle" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_api_key" ON "api_key";
--> statement-breakpoint
CREATE POLICY "deny_all_api_key" ON "api_key" FOR ALL TO anon,
authenticated USING (false)
WITH
    CHECK (false);
--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_api_key_rate" ON "api_key_rate";
--> statement-breakpoint
CREATE POLICY "deny_all_api_key_rate" ON "api_key_rate" FOR ALL TO anon,
authenticated USING (false)
WITH
    CHECK (false);
--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_login_throttle" ON "login_throttle";
--> statement-breakpoint
CREATE POLICY "deny_all_login_throttle" ON "login_throttle" FOR ALL TO anon,
authenticated USING (false)
WITH
    CHECK (false);
