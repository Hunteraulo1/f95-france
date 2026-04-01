ALTER TABLE public.game_translation
ADD COLUMN IF NOT EXISTS version varchar(100);
