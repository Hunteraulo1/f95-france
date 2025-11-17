import { getUserById } from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	createTranslationDeleteSubmission,
	createTranslationUpdateSubmission
} from '$lib/server/submissions';
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
		const { translationName, version, tversion, status, ttype, tlink, directMode, ac } = body;

		// Validation des données requises
		if (!version || !tversion || !status || !ttype || !tlink) {
			return json({ error: 'Tous les champs sont requis' }, { status: 400 });
		}

		// Vérifier que la traduction existe et appartient au jeu
		const existingTranslation = await db
			.select({ id: table.gameTranslation.id })
			.from(table.gameTranslation)
			.where(
				and(eq(table.gameTranslation.id, translationId), eq(table.gameTranslation.gameId, gameId))
			)
			.limit(1);

		if (existingTranslation.length === 0) {
			return json({ error: 'Traduction non trouvée' }, { status: 404 });
		}

		// Recharger l'utilisateur depuis la base de données pour avoir la valeur à jour de directMode
		const currentUser = await getUserById(locals.user.id);
		if (!currentUser) {
			return json({ error: 'Utilisateur non trouvé' }, { status: 404 });
		}

		// Déterminer le mode d'action selon le rôle de l'utilisateur
		const userRole = currentUser.role;
		// Utiliser directMode de la requête si fourni, sinon utiliser la préférence de l'utilisateur
		const useDirectMode = directMode !== undefined ? directMode : (currentUser.directMode ?? true);
		const shouldCreateSubmission =
			userRole === 'translator' || (userRole === 'superadmin' && !useDirectMode);

		if (shouldCreateSubmission) {
			// Créer une soumission pour les traducteurs ou superadmins en mode soumission
			await createTranslationUpdateSubmission(currentUser.id, gameId, translationId, {
				translationName: translationName || null,
				version,
				tversion,
				status,
				ttype,
				tlink
			});

			return json({
				message: 'Soumission créée avec succès. Elle sera examinée par un administrateur.',
				submission: true
			});
		}

		// Mode direct pour les admins ou superadmins en mode direct
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
				ac: ac ?? false,
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
export const DELETE: RequestHandler = async ({ params, request, locals }) => {
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
				and(eq(table.gameTranslation.id, translationId), eq(table.gameTranslation.gameId, gameId))
			)
			.limit(1);

		if (existingTranslation.length === 0) {
			return json({ error: 'Traduction non trouvée' }, { status: 404 });
		}

		// Recharger l'utilisateur depuis la base de données pour avoir la valeur à jour de directMode
		const currentUser = await getUserById(locals.user.id);
		if (!currentUser) {
			return json({ error: 'Utilisateur non trouvé' }, { status: 404 });
		}

		// Récupérer directMode depuis le body si fourni
		let directMode: boolean | undefined;
		try {
			const bodyText = await request.text();
			if (bodyText) {
				const body = JSON.parse(bodyText);
				directMode = body.directMode;
			}
		} catch {
			// Si pas de body ou erreur de parsing, utiliser la préférence de l'utilisateur
		}

		// Déterminer le mode d'action selon le rôle de l'utilisateur
		const userRole = currentUser.role;
		// Utiliser directMode de la requête si fourni, sinon utiliser la préférence de l'utilisateur
		const useDirectMode = directMode !== undefined ? directMode : (currentUser.directMode ?? true);
		const shouldCreateSubmission =
			userRole === 'translator' || (userRole === 'superadmin' && !useDirectMode);

		if (shouldCreateSubmission) {
			// Créer une soumission pour les traducteurs ou superadmins en mode soumission
			await createTranslationDeleteSubmission(currentUser.id, gameId, translationId);

			return json({
				message:
					'Soumission de suppression créée avec succès. Elle sera examinée par un administrateur.',
				submission: true
			});
		}

		// Mode direct pour les admins ou superadmins en mode direct
		// Supprimer la traduction
		await db.delete(table.gameTranslation).where(eq(table.gameTranslation.id, translationId));

		return json({ message: 'Traduction supprimée avec succès' });
	} catch (error) {
		console.error('Erreur lors de la suppression de la traduction:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
