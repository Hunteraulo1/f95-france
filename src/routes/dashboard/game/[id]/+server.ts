import { getUserById } from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { createGameDeleteSubmission, createGameUpdateSubmission } from '$lib/server/submissions';
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
		const { name, description, type, website, threadId, tags, link, image, directMode } = body;

		// Valider les données requises
		if (!name || !type || !website || !image) {
			return json({ error: 'Nom, type, site web et image sont requis' }, { status: 400 });
		}

		// Vérifier que le jeu existe
		const existingGame = await db
			.select({ id: table.game.id })
			.from(table.game)
			.where(eq(table.game.id, gameId))
			.limit(1);

		if (existingGame.length === 0) {
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
			await createGameUpdateSubmission(currentUser.id, gameId, {
				name,
				description: description || null,
				type,
				website,
				threadId: threadId ? parseInt(threadId) : null,
				tags: tags || null,
				link: link || null,
				image
			});

			return json({
				message: 'Soumission créée avec succès. Elle sera examinée par un administrateur.',
				submission: true
			});
		}

		// Mode direct pour les admins ou superadmins en mode direct
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

export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	const gameId = params.id;

	if (!gameId) {
		return json({ error: 'ID du jeu requis' }, { status: 400 });
	}

	try {
		// Vérifier que le jeu existe
		const existingGame = await db
			.select({ id: table.game.id })
			.from(table.game)
			.where(eq(table.game.id, gameId))
			.limit(1);

		if (existingGame.length === 0) {
			return json({ error: 'Jeu non trouvé' }, { status: 404 });
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
			await createGameDeleteSubmission(currentUser.id, gameId);

			return json({
				message:
					'Soumission de suppression créée avec succès. Elle sera examinée par un administrateur.',
				submission: true
			});
		}

		// Mode direct pour les admins ou superadmins en mode direct
		// Supprimer d'abord toutes les traductions associées
		await db.delete(table.gameTranslation).where(eq(table.gameTranslation.gameId, gameId));

		// Supprimer le jeu
		await db.delete(table.game).where(eq(table.game.id, gameId));

		return json({ message: 'Jeu supprimé avec succès' });
	} catch (error) {
		console.error('Erreur lors de la suppression du jeu:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
