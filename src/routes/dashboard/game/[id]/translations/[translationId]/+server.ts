import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

// PUT - Modifier une traduction
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	const { id: gameId, translationId } = params;
	
	if (!gameId || !translationId) {
		return json({ error: 'ID du jeu et ID de traduction requis' }, { status: 400 });
	}

	try {
		const body = await request.json();
		const { translationName, version, tversion, status, ttype, tlink } = body;

		// Validation des données requises
		if (!version || !tversion || !status || !ttype || !tlink) {
			return json({ error: 'Tous les champs sont requis' }, { status: 400 });
		}

		// Vérifier que la traduction existe et appartient au jeu
		const existingTranslation = await db
			.select({ id: table.gameTranslation.id })
			.from(table.gameTranslation)
			.where(
				and(
					eq(table.gameTranslation.id, translationId),
					eq(table.gameTranslation.gameId, gameId)
				)
			)
			.limit(1);

		if (existingTranslation.length === 0) {
			return json({ error: 'Traduction non trouvée' }, { status: 404 });
		}

		// Mettre à jour la traduction
		await db
			.update(table.gameTranslation)
			.set({
				translationName,
				version,
				tversion,
				status,
				ttype,
				tlink,
				updatedAt: new Date()
			})
			.where(eq(table.gameTranslation.id, translationId));

		return json({ message: 'Traduction modifiée avec succès' });
	} catch (error) {
		console.error('Erreur lors de la modification de la traduction:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};

// DELETE - Supprimer une traduction
export const DELETE: RequestHandler = async ({ params, locals }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	const { id: gameId, translationId } = params;
	
	if (!gameId || !translationId) {
		return json({ error: 'ID du jeu et ID de traduction requis' }, { status: 400 });
	}

	try {
		// Vérifier que la traduction existe et appartient au jeu
		const existingTranslation = await db
			.select({ id: table.gameTranslation.id })
			.from(table.gameTranslation)
			.where(
				and(
					eq(table.gameTranslation.id, translationId),
					eq(table.gameTranslation.gameId, gameId)
				)
			)
			.limit(1);

		if (existingTranslation.length === 0) {
			return json({ error: 'Traduction non trouvée' }, { status: 404 });
		}

		// Supprimer la traduction
		await db
			.delete(table.gameTranslation)
			.where(eq(table.gameTranslation.id, translationId));

		return json({ message: 'Traduction supprimée avec succès' });
	} catch (error) {
		console.error('Erreur lors de la suppression de la traduction:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
