import { dateRangeOnColumn, parseOptionalDateRangeQuery } from '$lib/server/api/date-range-query';
import { translationsByGameIds } from '$lib/server/api/games-with-translations';
import { parseInclude } from '$lib/server/api/include-query';
import { embeddedGameFromRow } from '$lib/server/api/updates-embedded-game';
import { db } from '$lib/server/db';
import { enginesPerGameSubquery } from '$lib/server/db/engines-per-game-subquery';
import { game, update as updateTable } from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key'
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

		const range = parseOptionalDateRangeQuery(url.searchParams);
		if (!range.ok) {
			return json({ error: range.message }, { status: 400, headers: corsHeaders });
		}
		const updateDateWhere = dateRangeOnColumn(updateTable.createdAt, range.from, range.to);

		const inc = parseInclude(url.searchParams);
		const withGame = inc.has('game');
		const withTranslations = inc.has('translations');

		const slimSelect = () =>
			db
				.select({
					updateId: updateTable.id,
					updateStatus: updateTable.status,
					updateCreatedAt: updateTable.createdAt,
					updateUpdatedAt: updateTable.updatedAt,
					gameId: updateTable.gameId
				})
				.from(updateTable);

		if (!withGame && !withTranslations) {
			const slim = await (updateDateWhere ? slimSelect().where(updateDateWhere) : slimSelect())
				.orderBy(desc(updateTable.createdAt))
				.limit(limit);
			return json(slim, { headers: corsHeaders });
		}

		if (!withGame && withTranslations) {
			const slim = await (updateDateWhere ? slimSelect().where(updateDateWhere) : slimSelect())
				.orderBy(desc(updateTable.createdAt))
				.limit(limit);
			const byGame = await translationsByGameIds(slim.map((s) => s.gameId));
			const rows = slim.map((s) => ({
				...s,
				game: {
					id: s.gameId,
					translations: byGame.get(s.gameId) ?? []
				}
			}));
			return json(rows, { headers: corsHeaders });
		}

		const flatBase = db
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
			.leftJoin(enginesPerGameSubquery, eq(game.id, enginesPerGameSubquery.gameId));

		const flat = await (updateDateWhere ? flatBase.where(updateDateWhere) : flatBase)
			.orderBy(desc(updateTable.createdAt))
			.limit(limit);

		if (!withTranslations) {
			const rows = flat.map((r) => ({
				updateId: r.updateId,
				updateStatus: r.updateStatus,
				updateCreatedAt: r.updateCreatedAt,
				updateUpdatedAt: r.updateUpdatedAt,
				gameId: r.gameId,
				game: embeddedGameFromRow(r)
			}));
			return json(rows, { headers: corsHeaders });
		}

		const byGame = await translationsByGameIds(flat.map((r) => r.gameId));
		const rows = flat.map((r) => ({
			updateId: r.updateId,
			updateStatus: r.updateStatus,
			updateCreatedAt: r.updateCreatedAt,
			updateUpdatedAt: r.updateUpdatedAt,
			gameId: r.gameId,
			game: {
				...embeddedGameFromRow(r),
				translations: byGame.get(r.gameId) ?? []
			}
		}));
		return json(rows, { headers: corsHeaders });
	} catch (error) {
		console.error('Error fetching updates:', error);
		return json({ error: 'Impossible de récupérer les mises à jour.' }, { status: 500, headers: corsHeaders });
	}
};
