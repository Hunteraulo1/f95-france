-- Supabase security hardening: enable RLS on remaining public tables.
-- By default, with RLS enabled and no policy, anon/authenticated cannot access rows.

ALTER TABLE public.game_translation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translator ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
