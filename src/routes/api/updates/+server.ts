import { enginesPerGameSubquery } from '$lib/server/db/engines-per-game-subquery';
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

		const flat = await db
			.select({
				updateId: updateTable.id,
				updateStatus: updateTable.status,
				updateCreatedAt: updateTable.createdAt,
				updateUpdatedAt: updateTable.updatedAt,
				gameId: game.id,
				gameName: game.name,
				gameImage: game.image,
				gameLink: game.link,
				gameWebsite: game.website,
				gameThreadId: game.threadId,
				gameGameVersion: game.gameVersion,
				gameEngineTypes: enginesPerGameSubquery.engineTypes,
				gameTags: game.tags
			})
			.from(updateTable)
			.innerJoin(game, eq(updateTable.gameId, game.id))
			.leftJoin(enginesPerGameSubquery, eq(game.id, enginesPerGameSubquery.gameId))
			.orderBy(desc(updateTable.createdAt))
			.limit(limit);

		const rows = flat.map((r) => {
			const engineTypes = Array.isArray(r.gameEngineTypes) ? r.gameEngineTypes : [];
			return {
				updateId: r.updateId,
				updateStatus: r.updateStatus,
				updateCreatedAt: r.updateCreatedAt,
				updateUpdatedAt: r.updateUpdatedAt,
				game: {
					id: r.gameId,
					name: r.gameName,
					image: r.gameImage,
					link: r.gameLink,
					website: r.gameWebsite,
					threadId: r.gameThreadId,
					gameVersion: r.gameGameVersion,
					type: engineTypes[0] ?? 'other',
					engineTypes,
					tags: r.gameTags
				}
			};
		});

		return json(rows, { headers: corsHeaders });
	} catch (error) {
		console.error('Error fetching updates:', error);
		return json({ error: 'Failed to fetch updates' }, { status: 500, headers: corsHeaders });
	}
};
