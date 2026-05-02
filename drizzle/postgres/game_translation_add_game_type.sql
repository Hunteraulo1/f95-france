-- Moteur du jeu (RenPy, Unity, HTML, etc.) : déplacé de game vers game_translation.
ALTER TABLE "game_translation" ADD COLUMN IF NOT EXISTS "game_type" varchar(32) NOT NULL DEFAULT 'other';

UPDATE "game_translation" gt
SET "game_type" = g."type"
FROM "game" g
WHERE gt."game_id" = g."id";

ALTER TABLE "game" DROP COLUMN IF EXISTS "type";
