-- Supabase Database Linter 0026 / 0027 (pg_graphql_*_table_exposed)
--
-- Même logique que passkey_revoke_anon_authenticated.sql : retirer tout privilège
-- `anon` / `authenticated` pour que les tables ne figurent plus dans le schéma GraphQL public.
--
-- L’application utilise DATABASE_URL (rôle serveur), pas la clé anon.

REVOKE ALL PRIVILEGES ON
TABLE public.api_key
FROM anon, authenticated;

REVOKE ALL PRIVILEGES ON
TABLE public.api_key_rate
FROM anon, authenticated;

REVOKE ALL PRIVILEGES ON
TABLE public.login_throttle
FROM anon, authenticated;
