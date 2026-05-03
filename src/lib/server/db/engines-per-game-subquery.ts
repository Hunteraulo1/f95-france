import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';

/**
 * Tous les moteurs distincts (`game_type`) par jeu, agrégés depuis les traductions.
 */
export const enginesPerGameSubquery = db
	.select({
		gameId: table.gameTranslation.gameId,
		engineTypes: sql<string[]>`array_agg(distinct ${table.gameTranslation.gameType})`.as('engine_types')
	})
	.from(table.gameTranslation)
	.groupBy(table.gameTranslation.gameId)
	.as('engines_per_game');
