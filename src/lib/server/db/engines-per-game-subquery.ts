import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';

/** Convertit le résultat JSON_ARRAYAGG de MariaDB en tableau de chaînes. */
export function parseEngineTypes(value: unknown): string[] {
	if (Array.isArray(value)) return value.map(String);
	if (typeof value === 'string' && value) {
		try {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed)) return parsed.map(String);
		} catch {
			// GROUP_CONCAT fallback: "renpy,unity"
			return value.split(',').filter(Boolean);
		}
	}
	return [];
}

/** Tous les moteurs distincts (`game_type`) par jeu, agrégés depuis les traductions. */
export function enginesPerGameSubquery() {
	return db
		.select({
			gameId: table.gameTranslation.gameId,
			engineTypes: sql<string>`JSON_ARRAYAGG(distinct ${table.gameTranslation.gameType})`.as(
				'engine_types'
			)
		})
		.from(table.gameTranslation)
		.groupBy(table.gameTranslation.gameId)
		.as('engines_per_game');
}
