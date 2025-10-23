import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	const gameId = params.id;
	
	if (!gameId) {
		return json({ error: 'ID du jeu requis' }, { status: 400 });
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
			return json({ error: 'Jeu non trouvé' }, { status: 404 });
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

		return json({ 
			game: game[0], 
			translations 
		});
	} catch (error) {
		console.error('Erreur lors de la récupération du jeu:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
