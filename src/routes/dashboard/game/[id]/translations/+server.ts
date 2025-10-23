import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

// POST - Créer une nouvelle traduction
export const POST: RequestHandler = async ({ params, request, locals }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	const gameId = params.id;
	
	if (!gameId) {
		return json({ error: 'ID du jeu requis' }, { status: 400 });
	}

	try {
		const body = await request.json();
		const { translationName, version, tversion, status, ttype, tlink } = body;

		// Validation des données requises
		if (!version || !tversion || !status || !ttype || !tlink) {
			return json({ error: 'Tous les champs sont requis' }, { status: 400 });
		}

		// Vérifier que le jeu existe
		const game = await db
			.select({ id: table.games.id })
			.from(table.games)
			.where(eq(table.games.id, gameId))
			.limit(1);

		if (game.length === 0) {
			return json({ error: 'Jeu non trouvé' }, { status: 404 });
		}

		// Créer la nouvelle traduction
		await db
			.insert(table.gameTranslations)
			.values({
				gameId,
				translationName,
				version,
				tversion,
				status,
				ttype,
				tlink,
				traductorId: locals.user.id
			});

		return json({ message: 'Traduction créée avec succès' }, { status: 201 });
	} catch (error) {
		console.error('Erreur lors de la création de la traduction:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
