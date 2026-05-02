import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';

export type GameEngineColumn = (typeof table.gameTranslation.$inferSelect)['gameType'];

const ALLOWED = ['renpy', 'rpgm', 'unity', 'unreal', 'flash', 'html', 'qsp', 'other'] as const;

export function coerceGameEngineType(value: string | null | undefined): GameEngineColumn {
	const v = String(value ?? 'other').toLowerCase().trim();
	if ((ALLOWED as readonly string[]).includes(v)) return v as GameEngineColumn;
	return 'other';
}

export async function defaultGameTypeForGame(gameId: string): Promise<GameEngineColumn> {
	const [r] = await db
		.select({ gameType: table.gameTranslation.gameType })
		.from(table.gameTranslation)
		.where(eq(table.gameTranslation.gameId, gameId))
		.orderBy(asc(table.gameTranslation.createdAt))
		.limit(1);
	return r?.gameType ?? 'other';
}
