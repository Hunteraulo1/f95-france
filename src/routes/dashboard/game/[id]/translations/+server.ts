import { getUserById } from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { createTranslationSubmission } from '$lib/server/submissions';
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
		const {
			translationName,
			version,
			tversion,
			status,
			ttype,
			tlink,
			tname,
			directMode,
			ac,
			translatorId,
			proofreaderId
		} = body;

		// Validation des données requises
		// Le lien n'est pas requis pour les traductions intégrées ou "pas de traduction"
		const linkNotRequired = tname === 'integrated' || tname === 'no_translation';
		if (!version || !tversion || !status || !ttype || (!linkNotRequired && !tlink)) {
			return json(
				{
					error: linkNotRequired
						? 'Les champs Version, Version de traduction, Statut et Type sont requis'
						: 'Tous les champs sont requis'
				},
				{ status: 400 }
			);
		}

		// Vérifier que le jeu existe
		const game = await db
			.select({ id: table.game.id })
			.from(table.game)
			.where(eq(table.game.id, gameId))
			.limit(1);

		if (game.length === 0) {
			return json({ error: 'Jeu non trouvé' }, { status: 404 });
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
			await createTranslationSubmission(currentUser.id, gameId, {
				translationName: translationName || null,
				version,
				tversion,
				status,
				ttype,
				tlink,
				translatorId: translatorId || null,
				proofreaderId: proofreaderId || null,
				ac: ac ?? null
			});

			return json(
				{
					message: 'Soumission créée avec succès. Elle sera examinée par un administrateur.',
					submission: true
				},
				{ status: 201 }
			);
		}

		// Mode direct pour les admins ou superadmins en mode direct
		// Créer la nouvelle traduction
		// Pour les traductions intégrées ou "pas de traduction", le lien doit être une chaîne vide
		// (le champ est NOT NULL dans le schéma, donc on utilise '' au lieu de null)
		await db.insert(table.gameTranslation).values({
			gameId,
			translationName,
			version,
			tversion,
			status,
			ttype,
			tlink: linkNotRequired || tlink === null ? '' : (tlink || ''),
			tname: (tname as 'no_translation' | 'integrated' | 'translation' | 'translation_with_mods') || 'translation',
			translatorId: translatorId || null,
			proofreaderId: proofreaderId || null,
			ac: ac ?? false
		});

		return json({ message: 'Traduction créée avec succès' }, { status: 201 });
	} catch (error) {
		console.error('Erreur lors de la création de la traduction:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
