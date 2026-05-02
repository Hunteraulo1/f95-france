-- Politiques RLS explicites "deny all" pour supprimer les warnings
-- `rls_enabled_no_policy` dans Supabase Advisor.
-- Contexte: l'app passe par le backend/service role, pas par des accès directs anon/authenticated.

-- api_log
DROP POLICY IF EXISTS deny_all_api_log ON public.api_log;
CREATE POLICY deny_all_api_log
ON public.api_log
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- config
DROP POLICY IF EXISTS deny_all_config ON public.config;
CREATE POLICY deny_all_config
ON public.config
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- game
DROP POLICY IF EXISTS deny_all_game ON public.game;
CREATE POLICY deny_all_game
ON public.game
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- game_translation
DROP POLICY IF EXISTS deny_all_game_translation ON public.game_translation;
CREATE POLICY deny_all_game_translation
ON public.game_translation
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- notification
DROP POLICY IF EXISTS deny_all_notification ON public.notification;
CREATE POLICY deny_all_notification
ON public.notification
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- passkey
DROP POLICY IF EXISTS deny_all_passkey ON public.passkey;
CREATE POLICY deny_all_passkey
ON public.passkey
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- passkey_challenge
DROP POLICY IF EXISTS deny_all_passkey_challenge ON public.passkey_challenge;
CREATE POLICY deny_all_passkey_challenge
ON public.passkey_challenge
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- session
DROP POLICY IF EXISTS deny_all_session ON public.session;
CREATE POLICY deny_all_session
ON public.session
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- submission
DROP POLICY IF EXISTS deny_all_submission ON public.submission;
CREATE POLICY deny_all_submission
ON public.submission
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- translator
DROP POLICY IF EXISTS deny_all_translator ON public.translator;
CREATE POLICY deny_all_translator
ON public.translator
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- update
DROP POLICY IF EXISTS deny_all_update ON public."update";
CREATE POLICY deny_all_update
ON public."update"
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- user
DROP POLICY IF EXISTS deny_all_user ON public."user";
CREATE POLICY deny_all_user
ON public."user"
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
