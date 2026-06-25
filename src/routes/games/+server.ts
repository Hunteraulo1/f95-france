import { parsePublicGamesListParams } from '$lib/games/games-filter-url';
import { listPublicGames } from '$lib/server/public-games';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const params = parsePublicGamesListParams(url.searchParams);
	const result = await listPublicGames(params);
	return json(result);
};
