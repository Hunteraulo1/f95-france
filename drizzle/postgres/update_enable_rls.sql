-- Supabase security: enable RLS on public.update
-- Important: with RLS enabled and no policy, anon/authenticated roles cannot read/write.
-- Server-side privileged roles (service role / table owner) keep working.
ALTER TABLE public."update" ENABLE ROW LEVEL SECURITY;
