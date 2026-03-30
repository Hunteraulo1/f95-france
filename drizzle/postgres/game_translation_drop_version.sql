-- Version jeu : colonne game.game_version ; plus de version par ligne traduction
ALTER TABLE public.game_translation DROP COLUMN IF EXISTS version;
