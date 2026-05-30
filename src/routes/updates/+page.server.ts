import { listTranslatorFilterOptions } from '$lib/server/public-games-translators';
import { listPublicUpdates } from '$lib/server/public-updates';
import {
	buildUpdatesFilterGroupsForUi,
	parsePublicUpdatesListParams
} from '$lib/updates/updates-filter-url';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const params = parsePublicUpdatesListParams(url.searchParams);

	try {
		const translators = await listTranslatorFilterOptions();
		const result = await listPublicUpdates(params);

		return {
			...result,
			filterGroups: buildUpdatesFilterGroupsForUi(params, translators),
			translatorIds: translators,
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
			error: 'Impossible de charger les mises à jour pour le moment.'
		};
	}
};
