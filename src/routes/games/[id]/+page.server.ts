import { loadPublicGameDetail } from '$lib/server/public-game-detail';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const gameId = String(params.id ?? '').trim();
	if (!gameId) {
		return { game: null, error: 'Identifiant du jeu requis' };
	}

	try {
		const game = await loadPublicGameDetail(gameId);
		return { game, error: null as string | null };
	} catch (error) {
		console.error('Erreur chargement fiche jeu:', error);
		return { game: null, error: 'Jeu introuvable ou indisponible.' };
	}
};
