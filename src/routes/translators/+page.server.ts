import {
	listPublicTranslators,
	PUBLIC_TRANSLATORS_PAGE_SIZE
} from '$lib/server/public-translators';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);

	try {
		return {
			...(await listPublicTranslators({ query: q, page: 1 })),
			q,
			error: null as string | null
		};
	} catch (error) {
		console.error('Erreur chargement page traducteurs:', error);
		return {
			translators: [],
			q,
			total: 0,
			page: 1,
			pageSize: PUBLIC_TRANSLATORS_PAGE_SIZE,
			totalPages: 1,
			error: 'Impossible de charger les traducteurs pour le moment.'
		};
	}
};
