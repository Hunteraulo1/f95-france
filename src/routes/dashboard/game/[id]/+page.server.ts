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
				id: table.game.id,
				name: table.game.name,
				description: table.game.description,
				website: table.game.website,
				threadId: table.game.threadId,
				link: table.game.link,
				tags: table.game.tags,
				type: table.game.type,
				image: table.game.image,
				createdAt: table.game.createdAt,
				updatedAt: table.game.updatedAt
			})
			.from(table.game)
			.where(eq(table.game.id, gameId))
			.limit(1);

		if (game.length === 0) {
			throw error(404, 'Jeu non trouvé');
		}

		// Récupérer les traductions du jeu
		const translations = await db
			.select({
				id: table.gameTranslation.id,
        translationName: table.gameTranslation.translationName,
				status: table.gameTranslation.status,
				version: table.gameTranslation.version,
				tversion: table.gameTranslation.tversion,
				tlink: table.gameTranslation.tlink,
				translatorId: table.gameTranslation.translatorId,
				proofreaderId: table.gameTranslation.proofreaderId,
				ttype: table.gameTranslation.ttype,
				ac: table.gameTranslation.ac,
				createdAt: table.gameTranslation.createdAt,
				updatedAt: table.gameTranslation.updatedAt
			})
			.from(table.gameTranslation)
			.where(eq(table.gameTranslation.gameId, gameId));

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
