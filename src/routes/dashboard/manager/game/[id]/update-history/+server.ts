import { assertPermission, hasPermission } from '$lib/server/permissions';
import { listGameUpdateHistoryPage } from '$lib/server/game-update-history-query';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	await assertPermission(locals, 'games.view_history');

	const gameId = String(params.id ?? '').trim();
	if (!gameId) throw error(400, 'Jeu invalide');

	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	const result = await listGameUpdateHistoryPage(gameId, requestedPage);

	return json({
		entries: result.entries,
		page: result.page,
		totalPages: result.totalPages,
		total: result.totalCount
	});
};
