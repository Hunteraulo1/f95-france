import {
	listPublicTranslators,
	PUBLIC_TRANSLATORS_PAGE_SIZE
} from '$lib/server/public-translators';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	try {
		return {
			...(await listPublicTranslators({ query: q, page })),
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
