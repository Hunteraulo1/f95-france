import { db } from '$lib/server/db';
import { gameTranslation } from '$lib/server/db/schema';
import { inArray } from 'drizzle-orm';

export type GameTranslationRow = typeof gameTranslation.$inferSelect;

/**
 * Traductions indexées par `gameId`. Chaque tableau est trié par `updatedAt` décroissant.
 */
export async function translationsByGameIds(
	gameIds: string[]
): Promise<Map<string, GameTranslationRow[]>> {
	const map = new Map<string, GameTranslationRow[]>();
	for (const id of gameIds) map.set(id, []);
	if (gameIds.length === 0) return map;

	const rows = await db
		.select()
		.from(gameTranslation)
		.where(inArray(gameTranslation.gameId, gameIds));

	for (const row of rows) {
		const list = map.get(row.gameId);
		if (list) list.push(row);
	}

	for (const list of map.values()) {
		list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
	}
	return map;
}
