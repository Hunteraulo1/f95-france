import { translationsByGameIds } from '$lib/server/api/games-with-translations';
import { parseInclude } from '$lib/server/api/include-query';
import { embeddedGameFromRow } from '$lib/server/api/updates-embedded-game';
import { enginesPerGameSubquery } from '$lib/server/db/engines-per-game-subquery';
import { db } from '$lib/server/db';
import { game, update as updateTable } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
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

export const GET: RequestHandler = async ({ params, url }) => {
	const updateId = params.id;

	if (!updateId) {
		return json({ error: "L'identifiant de la mise à jour est requis." }, { status: 400, headers: corsHeaders });
	}

	try {
		const inc = parseInclude(url.searchParams);
		const withGame = inc.has('game');
		const withTranslations = inc.has('translations');

		if (!withGame && !withTranslations) {
			const slim = await db
				.select({
					updateId: updateTable.id,
					updateStatus: updateTable.status,
					updateCreatedAt: updateTable.createdAt,
					updateUpdatedAt: updateTable.updatedAt,
					gameId: updateTable.gameId
				})
				.from(updateTable)
				.where(eq(updateTable.id, updateId))
				.limit(1);

			if (slim.length === 0) {
				return json({ error: 'Mise à jour introuvable.' }, { status: 404, headers: corsHeaders });
			}

			return json(slim[0], { headers: corsHeaders });
		}

		if (!withGame && withTranslations) {
			const slim = await db
				.select({
					updateId: updateTable.id,
					updateStatus: updateTable.status,
					updateCreatedAt: updateTable.createdAt,
					updateUpdatedAt: updateTable.updatedAt,
					gameId: updateTable.gameId
				})
				.from(updateTable)
				.where(eq(updateTable.id, updateId))
				.limit(1);

			if (slim.length === 0) {
				return json({ error: 'Mise à jour introuvable.' }, { status: 404, headers: corsHeaders });
			}

			const s = slim[0];
			const byGame = await translationsByGameIds([s.gameId]);
			return json(
				{
					...s,
					game: {
						id: s.gameId,
						translations: byGame.get(s.gameId) ?? []
					}
				},
				{ headers: corsHeaders }
			);
		}

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
			.where(eq(updateTable.id, updateId))
			.limit(1);

		if (flat.length === 0) {
			return json({ error: 'Mise à jour introuvable.' }, { status: 404, headers: corsHeaders });
		}

		const r = flat[0];
		const base = {
			updateId: r.updateId,
			updateStatus: r.updateStatus,
			updateCreatedAt: r.updateCreatedAt,
			updateUpdatedAt: r.updateUpdatedAt,
			gameId: r.gameId,
			game: embeddedGameFromRow(r)
		};

		if (!withTranslations) {
			return json(base, { headers: corsHeaders });
		}

		const byGame = await translationsByGameIds([r.gameId]);
		return json(
			{
				...base,
				game: {
					...base.game,
					translations: byGame.get(r.gameId) ?? []
				}
			},
			{ headers: corsHeaders }
		);
	} catch (error) {
		console.error('Error fetching update:', error);
		return json({ error: 'Impossible de récupérer la mise à jour.' }, { status: 500, headers: corsHeaders });
	}
};
