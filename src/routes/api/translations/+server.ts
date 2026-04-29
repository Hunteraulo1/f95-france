import { db } from '$lib/server/db';
import { gameTranslation } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const gameId = url.searchParams.get('gameId')?.trim();

		const baseQuery = db.select().from(gameTranslation);
		const rows = gameId
			? await baseQuery
					.where(eq(gameTranslation.gameId, gameId))
					.orderBy(desc(gameTranslation.updatedAt))
			: await baseQuery.orderBy(desc(gameTranslation.updatedAt));

		return json(rows);
	} catch (error) {
		console.error('Error fetching translations:', error);
		return json({ error: 'Failed to fetch translations' }, { status: 500 });
	}
};
