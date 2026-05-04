-- Lint 0008 rls_enabled_no_policy : au moins une politique par table avec RLS (deny all pour anon/authenticated).
-- Les tables api_key / api_key_rate / login_throttle sont couvertes par 0008.
ALTER TABLE "api_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "config" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "game" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "game_translation" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "passkey" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "passkey_challenge" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "submission" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "translator" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "update" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_api_log" ON "api_log";
--> statement-breakpoint
CREATE POLICY "deny_all_api_log" ON "api_log" FOR ALL TO anon,
authenticated USING (false)
WITH
    CHECK (false);
--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_config" ON "config";
--> statement-breakpoint
CREATE POLICY "deny_all_config" ON "config" FOR ALL TO anon,
authenticated USING (false)
WITH
    CHECK (false);
--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_game" ON "game";
--> statement-breakpoint
CREATE POLICY "deny_all_game" ON "game" FOR ALL TO anon,
authenticated USING (false)
WITH
    CHECK (false);
--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_game_translation" ON "game_translation";
--> statement-breakpoint
CREATE POLICY "deny_all_game_translation" ON "game_translation" FOR ALL TO anon,
authenticated USING (false)
WITH
    CHECK (false);
--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_notification" ON "notification";
--> statement-breakpoint
CREATE POLICY "deny_all_notification" ON "notification" FOR ALL TO anon,
authenticated USING (false)
WITH
    CHECK (false);
--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_passkey" ON "passkey";
--> statement-breakpoint
CREATE POLICY "deny_all_passkey" ON "passkey" FOR ALL TO anon,
authenticated USING (false)
WITH
    CHECK (false);
--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_passkey_challenge" ON "passkey_challenge";
--> statement-breakpoint
CREATE POLICY "deny_all_passkey_challenge" ON "passkey_challenge" FOR ALL TO anon,
authenticated USING (false)
WITH
    CHECK (false);
--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_session" ON "session";
--> statement-breakpoint
CREATE POLICY "deny_all_session" ON "session" FOR ALL TO anon,
authenticated USING (false)
WITH
    CHECK (false);
--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_submission" ON "submission";
--> statement-breakpoint
CREATE POLICY "deny_all_submission" ON "submission" FOR ALL TO anon,
authenticated USING (false)
WITH
    CHECK (false);
--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_translator" ON "translator";
--> statement-breakpoint
CREATE POLICY "deny_all_translator" ON "translator" FOR ALL TO anon,
authenticated USING (false)
WITH
    CHECK (false);
--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_update" ON "update";
--> statement-breakpoint
CREATE POLICY "deny_all_update" ON "update" FOR ALL TO anon,
authenticated USING (false)
WITH
    CHECK (false);
--> statement-breakpoint
DROP POLICY IF EXISTS "deny_all_user" ON "user";
--> statement-breakpoint
CREATE POLICY "deny_all_user" ON "user" FOR ALL TO anon,
authenticated USING (false)
WITH
    CHECK (false);
