import { getUserById } from '$lib/server/auth';
import { gameAutoCheckEnabledForWebsite } from '$lib/server/game-auto-check';
import { enginesPerGameSubquery } from '$lib/server/db/engines-per-game-subquery';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { sendDiscordWebhookAdminNewSubmission } from '$lib/server/discord-webhook';
import { createGameUpdateRow } from '$lib/server/game-updates';
import { createGameSubmission } from '$lib/server/submissions';
import {
	syncTranslationToGoogleSheet,
	syncTranslatorToGoogleSheet
} from '$lib/server/google-sheets-sync';
import { coerceGameEngineType } from '$lib/server/game-engine-type';
import { json } from '@sveltejs/kit';
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const normVersion = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export const GET: RequestHandler = async ({ url, locals }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	const threadIdCheck = url.searchParams.get('threadIdCheck');
	if (threadIdCheck !== null) {
		const parsed = Number.parseInt(threadIdCheck, 10);
		if (Number.isNaN(parsed) || parsed <= 0) {
			return json({ gameExists: false, pendingSubmission: false });
		}

		try {
			const existingGame = await db
				.select({ id: table.game.id })
				.from(table.game)
				.where(eq(table.game.threadId, parsed))
				.limit(1);

			const pendingGameSubmission = await db
				.select({ id: table.submission.id })
				.from(table.submission)
				.where(
					and(
						eq(table.submission.type, 'game'),
						eq(table.submission.status, 'pending'),
						sql`(data::jsonb->'game'->>'threadId') IS NOT NULL AND (data::jsonb->'game'->>'threadId')::int = ${parsed}`
					)
				)
				.limit(1);

			return json({
				gameExists: existingGame.length > 0,
				pendingSubmission: pendingGameSubmission.length > 0
			});
		} catch (error) {
			console.error('Erreur lors de la vérification du thread:', error);
			return json({ error: 'Erreur serveur' }, { status: 500 });
		}
	}

	const query = url.searchParams.get('q');

	if (!query || query.trim().length === 0) {
		return json({ games: [] });
	}

	try {
		// Rechercher par nom de jeu (insensible à la casse) ou par threadId
		const threadIdQuery = Number.parseInt(query, 10);
		const whereClause = Number.isNaN(threadIdQuery)
			? ilike(table.game.name, `%${query}%`)
			: or(ilike(table.game.name, `%${query}%`), eq(table.game.threadId, threadIdQuery));
		const rawGames = await db
			.select({
				id: table.game.id,
				name: table.game.name,
				description: table.game.description,
				website: table.game.website,
				threadId: table.game.threadId,
				link: table.game.link,
				tags: table.game.tags,
				engineTypes: enginesPerGameSubquery.engineTypes,
				image: table.game.image,
				createdAt: table.game.createdAt,
				updatedAt: table.game.updatedAt
			})
			.from(table.game)
			.leftJoin(enginesPerGameSubquery, eq(table.game.id, enginesPerGameSubquery.gameId))
			.where(whereClause)
			.orderBy(table.game.name)
			.limit(20);

		const games = rawGames.map(({ engineTypes, ...rest }) => ({
			...rest,
			engineTypes: Array.isArray(engineTypes) ? engineTypes : []
		}));

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
		const { name, description, type, website, threadId, tags, link, image, gameVersion } = game;
		const scrapeUnchanged = Boolean(game?.scrapeUnchanged);
		const computedGameAutoCheck = gameAutoCheckEnabledForWebsite(website) && scrapeUnchanged;
		const computedTranslationAc =
			computedGameAutoCheck &&
			normVersion(translation?.tversion).length > 0 &&
			normVersion(translation?.tversion) === normVersion(gameVersion);

		// Valider les données requises
		if (!name || !type || !website || !image) {
			return json({ error: 'Nom, type, site web et image sont requis' }, { status: 400 });
		}

		const parsedThreadId =
			threadId !== null && threadId !== undefined && threadId !== ''
				? Number.parseInt(String(threadId), 10)
				: null;
		const validThreadId =
			parsedThreadId !== null && !Number.isNaN(parsedThreadId) && parsedThreadId > 0
				? parsedThreadId
				: null;

		// Doublon : même thread (le nom peut être partagé entre plusieurs jeux)
		if (validThreadId !== null) {
			const existingGameByThread = await db
				.select({ id: table.game.id })
				.from(table.game)
				.where(eq(table.game.threadId, validThreadId))
				.limit(1);

			if (existingGameByThread.length > 0) {
				return json({ error: 'Un jeu avec cet ID de thread existe déjà' }, { status: 409 });
			}

			const pendingForThread = await db
				.select({ id: table.submission.id })
				.from(table.submission)
				.where(
					and(
						eq(table.submission.type, 'game'),
						eq(table.submission.status, 'pending'),
						sql`(data::jsonb->'game'->>'threadId') IS NOT NULL AND (data::jsonb->'game'->>'threadId')::int = ${validThreadId}`
					)
				)
				.limit(1);

			if (pendingForThread.length > 0) {
				return json(
					{
						error: 'Une soumission pour ce thread est déjà en attente de validation.'
					},
					{ status: 409 }
				);
			}
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
					threadId: validThreadId,
					tags: tags || null,
					link: link || null,
					image,
					gameAutoCheck: computedGameAutoCheck,
					gameVersion:
						typeof gameVersion === 'string' && gameVersion.trim() ? gameVersion.trim() : null
				},
				translation
					? {
							translationName: translation.translationName,
							version:
								typeof translation.version === 'string' ? translation.version.trim() || null : null,
							tversion: translation.tversion,
							status: translation.status,
							ttype: translation.ttype,
							tlink: translation.tlink || null,
							translatorId: translation.translatorId || null,
							proofreaderId: translation.proofreaderId || null,
							ac: computedTranslationAc
						}
					: undefined
			);
			void sendDiscordWebhookAdminNewSubmission({
				submitterName: currentUser.username,
				gameName: name,
				gameImage: image
			});

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
			website,
			threadId: validThreadId,
			tags: tags || null,
			link: link || null,
			image,
			gameAutoCheck: computedGameAutoCheck,
			gameVersion:
				typeof gameVersion === 'string' && gameVersion.trim() ? gameVersion.trim() : null,
			createdAt: new Date(),
			updatedAt: new Date()
		});

		// Récupérer l'ID du jeu créé (threadId si présent, sinon nom — les noms peuvent être dupliqués)
		const createdGame = await db
			.select({ id: table.game.id })
			.from(table.game)
			.where(
				validThreadId !== null ? eq(table.game.threadId, validThreadId) : eq(table.game.name, name)
			)
			.limit(1);

		const gameId = createdGame[0]?.id;
		if (gameId) {
			await createGameUpdateRow(gameId, 'adding');
		}

		// Créer la traduction si elle est fournie
		if (translation && gameId) {
			const [createdTranslation] = await db
				.insert(table.gameTranslation)
				.values({
					gameId: gameId,
					translationName: translation.translationName,
					version:
						typeof translation.version === 'string' ? translation.version.trim() || null : null,
					tversion: translation.tversion,
					status: translation.status,
					ttype: translation.ttype,
					gameType: coerceGameEngineType(type),
					tlink: translation.tlink || '',
					translatorId: translation.translatorId || null,
					proofreaderId: translation.proofreaderId || null,
					ac: computedTranslationAc,
					createdAt: new Date(),
					updatedAt: new Date()
				})
				.returning({ id: table.gameTranslation.id });

			if (createdTranslation?.id) {
				void syncTranslationToGoogleSheet(createdTranslation.id).catch((err) => {
					console.warn('[google-sheets-sync] manager add translation failed:', err);
				});
			}
			if (translation.translatorId) {
				void syncTranslatorToGoogleSheet(String(translation.translatorId)).catch((err) => {
					console.warn('[google-sheets-sync] manager add translator failed:', err);
				});
			}
			if (translation.proofreaderId) {
				void syncTranslatorToGoogleSheet(String(translation.proofreaderId)).catch((err) => {
					console.warn('[google-sheets-sync] manager add proofreader failed:', err);
				});
			}
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
