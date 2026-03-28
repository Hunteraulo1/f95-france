-- Version de référence sur la fiche jeu (distincte des champs par ligne de traduction).
ALTER TABLE public.game
ADD COLUMN IF NOT EXISTS game_version varchar(100);
