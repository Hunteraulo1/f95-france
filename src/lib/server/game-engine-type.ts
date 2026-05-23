import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';

export type GameEngineColumn = (typeof table.gameTranslation.$inferSelect)['gameType'];

export { coerceGameEngineType } from '$lib/utils/game-engine-type';

export async function defaultGameTypeForGame(gameId: string): Promise<GameEngineColumn> {
	const [r] = await db
		.select({ gameType: table.gameTranslation.gameType })
		.from(table.gameTranslation)
		.where(eq(table.gameTranslation.gameId, gameId))
		.orderBy(asc(table.gameTranslation.createdAt))
		.limit(1);
	return r?.gameType ?? 'other';
}
