import { db } from '$lib/server/db';
import { game, gameTranslation, update as updateTable } from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
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

		const baseQuery = db
			.select({
				game: {
					id: game.id,
					name: game.name,
					description: game.description,
					website: game.website,
					threadId: game.threadId,
					link: game.link,
					tags: game.tags,
					type: game.type,
					image: game.image,
					gameAutoCheck: game.gameAutoCheck,
					gameVersion: game.gameVersion,
					createdAt: game.createdAt,
					updatedAt: game.updatedAt
				},
				translation: {
					id: gameTranslation.id,
					gameId: gameTranslation.gameId,
					translationName: gameTranslation.translationName,
					version: gameTranslation.version,
					status: gameTranslation.status,
					tversion: gameTranslation.tversion,
					tlink: gameTranslation.tlink,
					tname: gameTranslation.tname,
					translatorId: gameTranslation.translatorId,
					proofreaderId: gameTranslation.proofreaderId,
					ttype: gameTranslation.ttype,
					ac: gameTranslation.ac,
					createdAt: gameTranslation.createdAt,
					updatedAt: gameTranslation.updatedAt
				}
			})
			.from(gameTranslation)
			.innerJoin(game, eq(gameTranslation.gameId, game.id));

		const rows = gameId
			? await baseQuery
					.where(eq(gameTranslation.gameId, gameId))
					.orderBy(desc(gameTranslation.updatedAt))
			: await baseQuery.orderBy(desc(gameTranslation.updatedAt));

		const byGame = new Map<
			string,
			(typeof rows)[number]['game'] & { translations: Array<(typeof rows)[number]['translation']> }
		>();

		for (const row of rows) {
			const existing = byGame.get(row.game.id);
			if (!existing) {
				byGame.set(row.game.id, {
					...row.game,
					translations: [row.translation]
				});
				continue;
			}
			existing.translations.push(row.translation);
		}

		const updates = await db
			.select({
				updateId: updateTable.id,
				updateStatus: updateTable.status,
				updateCreatedAt: updateTable.createdAt,
				updateUpdatedAt: updateTable.updatedAt,
				game: {
					id: game.id,
					name: game.name,
					description: game.description,
					website: game.website,
					threadId: game.threadId,
					link: game.link,
					tags: game.tags,
					type: game.type,
					image: game.image,
					gameAutoCheck: game.gameAutoCheck,
					gameVersion: game.gameVersion,
					createdAt: game.createdAt,
					updatedAt: game.updatedAt
				}
			})
			.from(updateTable)
			.innerJoin(game, eq(updateTable.gameId, game.id))
			.orderBy(desc(updateTable.createdAt));

		return json(
			{
				games: Array.from(byGame.values()),
				updates
			},
			{
				headers: corsHeaders
			}
		);
	} catch (error) {
		console.error('Error fetching extension api data:', error);
		return json(
			{ error: 'Failed to fetch extension api data' },
			{
				status: 500,
				headers: corsHeaders
			}
		);
	}
};
