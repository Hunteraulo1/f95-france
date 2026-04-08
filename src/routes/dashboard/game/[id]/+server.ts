import { getUserById } from '$lib/server/auth';
import {
	clearAllTranslationAutoCheckForGame,
	resolveGameAutoCheckForWebsite
} from '$lib/server/game-auto-check';
import { sendDiscordWebhookAdminNewSubmission } from '$lib/server/discord-webhook';
import {
	deleteGameTranslationsFromGoogleSheet,
	syncGameTranslationsToGoogleSheet
} from '$lib/server/google-sheets-sync';
import { touchGameUpdatedToday } from '$lib/server/game-updates';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { createGameDeleteSubmission, createGameUpdateSubmission } from '$lib/server/submissions';
import { json } from '@sveltejs/kit';
import { and, eq, inArray, or } from 'drizzle-orm';
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
				gameAutoCheck: table.game.gameAutoCheck,
				gameVersion: table.game.gameVersion,
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
				version: table.gameTranslation.version,
				status: table.gameTranslation.status,
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
		const {
			name,
			description,
			type,
			website,
			threadId,
			tags,
			link,
			image,
			directMode,
			silentMode,
			gameAutoCheck,
			gameVersion
		} = body;

		// Valider les données requises
		if (!name || !type || !website || !image) {
			return json({ error: 'Nom, type, site web et image sont requis' }, { status: 400 });
		}

		// Vérifier que le jeu existe
		const existingGameRows = await db
			.select({
				id: table.game.id,
				name: table.game.name,
				description: table.game.description,
				type: table.game.type,
				website: table.game.website,
				threadId: table.game.threadId,
				tags: table.game.tags,
				link: table.game.link,
				image: table.game.image,
				gameAutoCheck: table.game.gameAutoCheck,
				gameVersion: table.game.gameVersion
			})
			.from(table.game)
			.where(eq(table.game.id, gameId))
			.limit(1);

		if (existingGameRows.length === 0) {
			return json({ error: 'Jeu non trouvé' }, { status: 404 });
		}

		const existingGame = existingGameRows[0];
		const prevGameAutoCheck = existingGame.gameAutoCheck;

		// Recharger l'utilisateur depuis la base de données pour avoir la valeur à jour de directMode
		const currentUser = await getUserById(locals.user.id);
		if (!currentUser) {
			return json({ error: 'Utilisateur non trouvé' }, { status: 404 });
		}

		// Déterminer le mode d'action selon le rôle de l'utilisateur
		const userRole = currentUser.role;
		const canUseSilentMode = userRole === 'admin' || userRole === 'superadmin';
		const isSilentMode = canUseSilentMode && Boolean(silentMode);
		const canManuallyToggleGameAutoCheck = userRole === 'admin' || userRole === 'superadmin';
		const parsedThreadId =
			threadId !== null && threadId !== undefined && threadId !== ''
				? parseInt(String(threadId), 10)
				: null;
		const nextThreadId =
			parsedThreadId !== null && !Number.isNaN(parsedThreadId) ? parsedThreadId : null;
		const hasNonVersionChanges =
			(name ?? '') !== (existingGame.name ?? '') ||
			(description || null) !== (existingGame.description ?? null) ||
			(type ?? '') !== (existingGame.type ?? '') ||
			(website ?? '') !== (existingGame.website ?? '') ||
			nextThreadId !== (existingGame.threadId ?? null) ||
			(tags || null) !== (existingGame.tags ?? null) ||
			(link || null) !== (existingGame.link ?? null) ||
			(image ?? '') !== (existingGame.image ?? '');
		const nextGameAutoCheck = hasNonVersionChanges
			? false
			: resolveGameAutoCheckForWebsite(
					website,
					canManuallyToggleGameAutoCheck && typeof gameAutoCheck === 'boolean'
						? gameAutoCheck
						: undefined,
					prevGameAutoCheck ?? true
				);
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
				threadId: nextThreadId,
				tags: tags || null,
				link: link || null,
				image,
				gameAutoCheck: nextGameAutoCheck,
				gameVersion: typeof gameVersion === 'string' ? gameVersion : null
			});
			void sendDiscordWebhookAdminNewSubmission({
				submitterName: currentUser.username,
				gameName: name,
				gameImage: image
			});

			return json({
				message: isSilentMode
					? 'Soumission créée (mode silencieux). Elle sera examinée par un administrateur.'
					: 'Soumission créée avec succès. Elle sera examinée par un administrateur.',
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
				gameAutoCheck: nextGameAutoCheck,
				gameVersion:
					typeof gameVersion === 'string' && gameVersion.trim() ? gameVersion.trim() : null,
				updatedAt: new Date()
			})
			.where(eq(table.game.id, gameId));

		if (!nextGameAutoCheck) {
			await clearAllTranslationAutoCheckForGame(gameId);
		}
		void syncGameTranslationsToGoogleSheet(gameId).catch((err) => {
			console.warn('[google-sheets-sync] game update rows failed:', err);
		});
		await touchGameUpdatedToday(gameId);

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
		let deleteBody: { reason?: string; directMode?: boolean } = {};
		try {
			const bodyText = await request.text();
			if (bodyText) {
				deleteBody = JSON.parse(bodyText) as { reason?: string; directMode?: boolean };
			}
		} catch {
			return json({ error: 'Corps de requête invalide' }, { status: 400 });
		}

		const reason = typeof deleteBody.reason === 'string' ? deleteBody.reason.trim() : '';
		if (!reason) {
			return json({ error: 'La raison de la suppression est obligatoire' }, { status: 400 });
		}

		const directMode = deleteBody.directMode;

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
			await createGameDeleteSubmission(currentUser.id, gameId, reason);
			const gameNameRow = await db
				.select({ name: table.game.name })
				.from(table.game)
				.where(eq(table.game.id, gameId))
				.limit(1);
			void sendDiscordWebhookAdminNewSubmission({
				submitterName: currentUser.username,
				gameName: gameNameRow[0]?.name ?? gameId,
				gameId
			});

			return json({
				message:
					'Soumission de suppression créée avec succès. Elle sera examinée par un administrateur.',
				submission: true
			});
		}

		// Mode direct pour les admins ou superadmins en mode direct
		let deletedTranslationIds: string[] = [];
		await db.transaction(async (tx) => {
			// Détacher les FK de submission avant suppression physique.
			const linkedTranslations = await tx
				.select({ id: table.gameTranslation.id })
				.from(table.gameTranslation)
				.where(eq(table.gameTranslation.gameId, gameId));

			const translationIds = linkedTranslations.map((t) => t.id);
			deletedTranslationIds = translationIds;
			const rejectionNote = `Rejet automatique: jeu supprimé (raison: ${reason}).`;

			// Les soumissions en attente liées à ce jeu/traductions deviennent refusées.
			if (translationIds.length > 0) {
				await tx
					.update(table.submission)
					.set({
						status: 'rejected',
						adminNotes: rejectionNote,
						updatedAt: new Date()
					})
					.where(
						and(
							eq(table.submission.status, 'pending'),
							or(
								eq(table.submission.gameId, gameId),
								inArray(table.submission.translationId, translationIds)
							)
						)
					);
			} else {
				await tx
					.update(table.submission)
					.set({
						status: 'rejected',
						adminNotes: rejectionNote,
						updatedAt: new Date()
					})
					.where(and(eq(table.submission.status, 'pending'), eq(table.submission.gameId, gameId)));
			}

			if (translationIds.length > 0) {
				await tx
					.update(table.submission)
					.set({ translationId: null, updatedAt: new Date() })
					.where(inArray(table.submission.translationId, translationIds));
			}

			await tx
				.update(table.submission)
				.set({ gameId: null, updatedAt: new Date() })
				.where(eq(table.submission.gameId, gameId));

			// Supprimer d'abord les lignes de la table "update" (FK vers game)
			// pour éviter la violation de contrainte sur la suppression du jeu.
			await tx.delete(table.update).where(eq(table.update.gameId, gameId));

			await tx.delete(table.gameTranslation).where(eq(table.gameTranslation.gameId, gameId));
			await tx.delete(table.game).where(eq(table.game.id, gameId));
		});
		if (deletedTranslationIds.length > 0) {
			void deleteGameTranslationsFromGoogleSheet(deletedTranslationIds).catch((err) => {
				console.warn('[google-sheets-sync] delete game rows failed:', err);
			});
		}
		return json({ message: 'Jeu supprimé avec succès' });
	} catch (error) {
		console.error('Erreur lors de la suppression du jeu:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
