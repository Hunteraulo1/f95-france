-- Équivalent de ce que `drizzle-kit push` appliquerait pour aligner `schema.ts` (champ game.gameAutoCheck).
-- À exécuter sur Postgres / Supabase si `db:push` ne peut pas finir l’introspection (ex. pooler).
ALTER TABLE public.game
ADD COLUMN IF NOT EXISTS game_auto_check boolean NOT NULL DEFAULT true;
