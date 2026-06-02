import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { listTranslatorFilterOptions } from '$lib/server/public-games-translators';
import { listPublicUpdates } from '$lib/server/public-updates';
import { parseSavedUpdatesFilters } from '$lib/server/saved-updates-filters';
import {
	buildUpdatesFilterGroupsForUi,
	parsePublicUpdatesListParams
} from '$lib/updates/updates-filter-url';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const params = parsePublicUpdatesListParams(url.searchParams);

	try {
		const [translators, savedFiltersRow] = await Promise.all([
			listTranslatorFilterOptions(),
			locals.user
				? db
						.select({ savedUpdatesFilters: user.savedUpdatesFilters })
						.from(user)
						.where(eq(user.id, locals.user.id))
						.limit(1)
				: Promise.resolve([])
		]);
		const result = await listPublicUpdates(params);
		const savedFilters = locals.user
			? parseSavedUpdatesFilters(savedFiltersRow[0]?.savedUpdatesFilters)
			: [];

		return {
			...result,
			filterGroups: buildUpdatesFilterGroupsForUi(params, translators),
			translatorIds: translators,
			savedFilters,
			isAuthenticated: Boolean(locals.user),
			error: null as string | null
		};
	} catch (error) {
		console.error('Erreur chargement page mises à jour:', error);
		return {
			updates: [],
			total: 0,
			page: 1,
			pageSize: 24,
			totalPages: 1,
			query: params.query,
			filters: params.filters,
			filterGroups: buildUpdatesFilterGroupsForUi(params, []),
			translatorIds: [],
			savedFilters: [],
			isAuthenticated: Boolean(locals.user),
			error: 'Impossible de charger les mises à jour pour le moment.'
		};
	}
};
