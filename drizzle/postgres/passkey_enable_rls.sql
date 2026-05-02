-- Activer RLS sur les tables passkey (Supabase Advisor / sécurité).
-- L’app accède à la base via le rôle Postgres du pooler (souvent service_role / postgres), qui contourne RLS.
-- anon / authenticated n’ont aucune policy utile → deny explicite dans rls_deny_all_policies.sql.

ALTER TABLE public.passkey ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkey_challenge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deny_all_passkey ON public.passkey;
CREATE POLICY deny_all_passkey
ON public.passkey
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS deny_all_passkey_challenge ON public.passkey_challenge;
CREATE POLICY deny_all_passkey_challenge
ON public.passkey_challenge
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
