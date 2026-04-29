import { db } from '$lib/server/db';
import { gameTranslation } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const OPTIONS: RequestHandler = async () =>
	new Response(null, {
		status: 204,
		headers: corsHeaders
	});

export const GET: RequestHandler = async ({ url }) => {
	try {
		const gameId = url.searchParams.get('gameId')?.trim();

		const baseQuery = db.select().from(gameTranslation);
		const rows = gameId
			? await baseQuery
					.where(eq(gameTranslation.gameId, gameId))
					.orderBy(desc(gameTranslation.updatedAt))
			: await baseQuery.orderBy(desc(gameTranslation.updatedAt));

		return json(rows, { headers: corsHeaders });
	} catch (error) {
		console.error('Error fetching translations:', error);
		return json({ error: 'Failed to fetch translations' }, { status: 500, headers: corsHeaders });
	}
};
