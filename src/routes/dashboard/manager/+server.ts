import { getUserById } from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { createGameSubmission } from '$lib/server/submissions';
import { json } from '@sveltejs/kit';
import { eq, like, or } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	const query = url.searchParams.get('q');

	if (!query || query.trim().length === 0) {
		return json({ games: [] });
	}

	try {
		// Rechercher par nom de jeu ou par threadId
		const games = await db
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
			.where(or(like(table.game.name, `%${query}%`), eq(table.game.threadId, parseInt(query) || 0)))
			.orderBy(table.game.name)
			.limit(20);

		return json({ games });
	} catch (error) {
		console.error('Erreur lors de la recherche des jeux:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { game, translation, directMode } = body;

		// Extraire les données du jeu
		const { name, description, type, website, threadId, tags, link, image } = game;

		// Valider les données requises
		if (!name || !type || !website || !image) {
			return json({ error: 'Nom, type, site web et image sont requis' }, { status: 400 });
		}

		// Vérifier si un jeu avec le même nom existe déjà
		const existingGame = await db
			.select({ id: table.game.id })
			.from(table.game)
			.where(eq(table.game.name, name))
			.limit(1);

		if (existingGame.length > 0) {
			return json({ error: 'Un jeu avec ce nom existe déjà' }, { status: 409 });
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
			await createGameSubmission(
				currentUser.id,
				{
					name,
					description: description || null,
					type,
					website,
					threadId: threadId ? parseInt(threadId) : null,
					tags: tags || null,
					link: link || null,
					image
				},
				translation && translation.translationName
					? {
							translationName: translation.translationName,
							version: translation.version,
							tversion: translation.tversion,
							status: translation.status,
							ttype: translation.ttype,
							tlink: translation.tlink || null
						}
					: undefined
			);

			return json({
				message: 'Soumission créée avec succès. Elle sera examinée par un administrateur.',
				submission: true
			});
		}

		// Mode direct pour les admins ou superadmins en mode direct
		// Créer le nouveau jeu
		await db.insert(table.game).values({
			name,
			description: description || null,
			type,
			website,
			threadId: threadId ? parseInt(threadId) : null,
			tags: tags || null,
			link: link || null,
			image,
			createdAt: new Date(),
			updatedAt: new Date()
		});

		// Récupérer l'ID du jeu créé en le recherchant par nom
		const createdGame = await db
			.select({ id: table.game.id })
			.from(table.game)
			.where(eq(table.game.name, name))
			.limit(1);

		const gameId = createdGame[0]?.id;

		// Créer la traduction si elle est fournie
		if (translation && translation.translationName) {
			await db.insert(table.gameTranslation).values({
				gameId: gameId,
				translationName: translation.translationName,
				version: translation.version,
				tversion: translation.tversion,
				status: translation.status,
				ttype: translation.ttype,
				tlink: translation.tlink || null,
				createdAt: new Date(),
				updatedAt: new Date()
			});
		}

		return json({
			message: translation ? 'Jeu et traduction ajoutés avec succès' : 'Jeu ajouté avec succès',
			gameId: gameId
		});
	} catch (error) {
		console.error("Erreur lors de l'ajout du jeu:", error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
