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
			return json({ error: 'Jeu non trouvé' }, { status: 404 });
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

		return json({ 
			game: game[0], 
			translations 
		});
	} catch (error) {
		console.error('Erreur lors de la récupération du jeu:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
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
		const { name, description, type, website, threadId, tags, link, image } = body;

		// Valider les données requises
		if (!name || !type || !website || !image) {
			return json({ error: 'Nom, type, site web et image sont requis' }, { status: 400 });
		}

		// Mettre à jour le jeu
		await db
			.update(table.game)
			.set({
				name,
				description: description || null,
				type,
				website,
				threadId: threadId ? parseInt(threadId) : null,
				tags: tags || null,
				link: link || null,
				image,
				updatedAt: new Date()
			})
			.where(eq(table.game.id, gameId));

		return json({ 
			message: 'Jeu modifié avec succès'
		});
	} catch (error) {
		console.error('Erreur lors de la modification du jeu:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
