import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		throw error(401, 'Non authentifié');
	}

	const gameId = params.id;
	
	if (!gameId) {
		throw error(400, 'ID du jeu requis');
	}

	try {
		// Récupérer le jeu avec ses traductions
		const game = await db
			.select({
				id: table.games.id,
				name: table.games.name,
				description: table.games.description,
				website: table.games.website,
				threadId: table.games.threadId,
				link: table.games.link,
				tags: table.games.tags,
				type: table.games.type,
				image: table.games.image,
				createdAt: table.games.createdAt,
				updatedAt: table.games.updatedAt
			})
			.from(table.games)
			.where(eq(table.games.id, gameId))
			.limit(1);

		if (game.length === 0) {
			throw error(404, 'Jeu non trouvé');
		}

		// Récupérer les traductions du jeu
		const translations = await db
			.select({
				id: table.gameTranslations.id,
				status: table.gameTranslations.status,
				version: table.gameTranslations.version,
				tversion: table.gameTranslations.tversion,
				tlink: table.gameTranslations.tlink,
				traductorId: table.gameTranslations.traductorId,
				proofreaderId: table.gameTranslations.proofreaderId,
				ttype: table.gameTranslations.ttype,
				ac: table.gameTranslations.ac,
				createdAt: table.gameTranslations.createdAt,
				updatedAt: table.gameTranslations.updatedAt
			})
			.from(table.gameTranslations)
			.where(eq(table.gameTranslations.gameId, gameId));

		return {
			game: game[0],
			translations
		};
	} catch (err) {
		if (err instanceof Error && err.message.includes('404')) {
			throw error(404, 'Jeu non trouvé');
		}
		console.error('Erreur lors de la récupération du jeu:', err);
		throw error(500, 'Erreur serveur');
	}
};
