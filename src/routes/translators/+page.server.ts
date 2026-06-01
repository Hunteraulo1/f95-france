import { listPublicTranslators } from '$lib/server/public-translators';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);

	try {
		const translators = await listPublicTranslators(q);

		return {
			translators,
			q,
			total: translators.length,
			error: null as string | null
		};
	} catch (error) {
		console.error('Erreur chargement page traducteurs:', error);
		return {
			translators: [],
			q,
			total: 0,
			error: 'Impossible de charger les traducteurs pour le moment.'
		};
	}
};
