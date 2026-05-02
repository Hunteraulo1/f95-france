import * as table from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';

/**
 * Type moteur affiché pour un jeu quand une seule valeur est exposée (liste, fiche sans détail par traduction).
 * = `game_type` de la traduction la plus ancienne du jeu.
 */
export const representativeGameTypeSql = sql<string | null>`(
	SELECT gt.game_type
	FROM game_translation gt
	WHERE gt.game_id = ${table.game.id}
	ORDER BY gt.created_at ASC
	LIMIT 1
)`;
