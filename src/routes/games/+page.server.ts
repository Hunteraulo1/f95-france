import { buildFilterGroupsForUi, parsePublicGamesListParams } from '$lib/games/games-filter-url';
import { listPublicGames } from '$lib/server/public-games';
import { listTranslatorFilterOptions } from '$lib/server/public-games-translators';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { parseSavedGamesFilters } from '$lib/server/saved-games-filters';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const params = parsePublicGamesListParams(url.searchParams);

	try {
		const [translators, savedFiltersRow] = await Promise.all([
			listTranslatorFilterOptions(),
			locals.user
				? db
						.select({ savedGamesFilters: user.savedGamesFilters })
						.from(user)
						.where(eq(user.id, locals.user.id))
						.limit(1)
				: Promise.resolve([])
		]);
		const [result, filterGroups] = await Promise.all([
			listPublicGames(params),
			Promise.resolve(buildFilterGroupsForUi(params, translators))
		]);
		const savedFilters = locals.user
			? parseSavedGamesFilters(savedFiltersRow[0]?.savedGamesFilters)
			: [];

		return {
			...result,
			filterGroups,
			translatorIds: translators,
			savedFilters,
			isAuthenticated: Boolean(locals.user),
			error: null as string | null
		};
	} catch (error) {
		console.error('Erreur chargement page jeux:', error);
		return {
			games: [],
			total: 0,
			page: 1,
			pageSize: 24,
			totalPages: 1,
			query: params.query,
			sort: params.sort,
			filters: params.filters,
			filterGroups: buildFilterGroupsForUi(params, []),
			translatorIds: [],
			savedFilters: [],
			isAuthenticated: Boolean(locals.user),
			error: 'Impossible de charger les jeux pour le moment.'
		};
	}
};
