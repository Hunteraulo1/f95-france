import { db } from '$lib/server/db';
import { game, update as updateTable } from '$lib/server/db/schema';
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
		const limitRaw = url.searchParams.get('limit');
		const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : 50;
		const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;

		const rows = await db
			.select({
				updateId: updateTable.id,
				updateStatus: updateTable.status,
				updateCreatedAt: updateTable.createdAt,
				updateUpdatedAt: updateTable.updatedAt,
				game: {
					id: game.id,
					name: game.name,
					image: game.image,
					link: game.link,
					website: game.website,
					threadId: game.threadId,
					gameVersion: game.gameVersion,
					type: game.type,
					tags: game.tags
				}
			})
			.from(updateTable)
			.innerJoin(game, eq(updateTable.gameId, game.id))
			.orderBy(desc(updateTable.createdAt))
			.limit(limit);

		return json(rows, { headers: corsHeaders });
	} catch (error) {
		console.error('Error fetching updates:', error);
		return json({ error: 'Failed to fetch updates' }, { status: 500, headers: corsHeaders });
	}
};
