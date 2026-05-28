import type { PageLoad } from './$types';

type HomeUpdate = {
	updateId: string;
	updateStatus: string | null;
	updateCreatedAt: string | null;
	game: {
		name: string | null;
		gameLink: string | null;
		gameWebsite: string | null;
		gameTags: string | null;
		gameVersion: string | null;
		gameEngineTypes: string[];
	};
};

export const load: PageLoad = async ({ fetch }) => {
	try {
		const response = await fetch('/api/updates?include=game&limit=3');
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const payload = await response.json();
		if (!Array.isArray(payload)) {
			throw new Error('Payload invalide');
		}

		const updates: HomeUpdate[] = payload.map((item) => {
			const game = (item?.game ?? {}) as Record<string, unknown>;
			const engineTypes = game.gameEngineTypes ?? game.engineTypes;

			return {
				updateId: String(item?.updateId ?? ''),
				updateStatus: item?.updateStatus ? String(item.updateStatus) : null,
				updateCreatedAt: item?.updateCreatedAt ? String(item.updateCreatedAt) : null,
				game: {
					name: game.name ? String(game.name) : null,
					gameLink: game.gameLink ? String(game.gameLink) : game.link ? String(game.link) : null,
					gameWebsite: game.gameWebsite
						? String(game.gameWebsite)
						: game.website
							? String(game.website)
							: null,
					gameTags: game.gameTags ? String(game.gameTags) : game.tags ? String(game.tags) : null,
					gameVersion: game.gameVersion ? String(game.gameVersion) : null,
					gameEngineTypes: Array.isArray(engineTypes)
						? engineTypes.map((value) => String(value))
						: []
				}
			};
		});

		return {
			updates,
			error: null
		};
	} catch (error) {
		console.error('Erreur chargement accueil:', error);
		return {
			updates: [] as HomeUpdate[],
			error: 'Impossible de charger les mises a jour pour le moment.'
		};
	}
};
