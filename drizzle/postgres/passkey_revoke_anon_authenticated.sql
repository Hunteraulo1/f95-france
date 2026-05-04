-- Supabase Database Linter 0026 / 0027 (pg_graphql_*_table_exposed)
--
-- RLS + policies « deny all » ne suffisent pas : tant que les rôles `anon` et
-- `authenticated` ont un GRANT SELECT, les tables restent visibles dans le schéma GraphQL.
--
-- L’application accède à Postgres via DATABASE_URL (rôle propriétaire / service_role),
-- pas via la clé anon — ces révocations ne cassent pas le backend.
--
-- À exécuter une fois sur le projet Supabase : SQL Editor, ou `psql` avec un rôle admin.

REVOKE ALL PRIVILEGES ON TABLE public.passkey FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.passkey_challenge FROM anon, authenticated;
