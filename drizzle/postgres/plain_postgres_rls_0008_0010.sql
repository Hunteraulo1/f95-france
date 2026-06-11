-- Variante Postgres sans rôles Supabase (Coolify, Docker dev, etc.).
-- Équivalent partiel de 0008 + 0010 : RLS activé, sans policies TO anon/authenticated.
-- Les fichiers drizzle/0008_*.sql … 0010_*.sql restent inchangés pour Supabase prod.
ALTER TABLE "api_key" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_key_rate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "login_throttle" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_api_key" ON "api_key";
DROP POLICY IF EXISTS "deny_all_api_key_rate" ON "api_key_rate";
DROP POLICY IF EXISTS "deny_all_login_throttle" ON "login_throttle";
ALTER TABLE "api_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "game" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "game_translation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "passkey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "passkey_challenge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "submission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "translator" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "update" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_api_log" ON "api_log";
DROP POLICY IF EXISTS "deny_all_config" ON "config";
DROP POLICY IF EXISTS "deny_all_game" ON "game";
DROP POLICY IF EXISTS "deny_all_game_translation" ON "game_translation";
DROP POLICY IF EXISTS "deny_all_notification" ON "notification";
DROP POLICY IF EXISTS "deny_all_passkey" ON "passkey";
DROP POLICY IF EXISTS "deny_all_passkey_challenge" ON "passkey_challenge";
DROP POLICY IF EXISTS "deny_all_session" ON "session";
DROP POLICY IF EXISTS "deny_all_submission" ON "submission";
DROP POLICY IF EXISTS "deny_all_translator" ON "translator";
DROP POLICY IF EXISTS "deny_all_update" ON "update";
DROP POLICY IF EXISTS "deny_all_user" ON "user";
ALTER TABLE IF EXISTS "app_log" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_app_log" ON "app_log";
