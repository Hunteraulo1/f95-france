import { hasPermission } from '$lib/server/permissions';
import { loadPublicGameDetail } from '$lib/server/public-game-detail';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const gameId = String(params.id ?? '').trim();
	if (!gameId) {
		return { game: null, error: 'Identifiant du jeu requis', canManageGame: false };
	}

	const canManageGame = hasPermission(locals, 'games.manage');

	try {
		const game = await loadPublicGameDetail(gameId);
		return { game, error: null as string | null, canManageGame };
	} catch (error) {
		console.error('Erreur chargement fiche jeu:', error);
		return { game: null, error: 'Jeu introuvable ou indisponible.', canManageGame };
	}
};
