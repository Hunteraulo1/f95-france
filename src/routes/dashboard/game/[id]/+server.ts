import { getUserById } from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	sendDiscordWebhookAdminNewSubmission,
	sendDiscordWebhookUpdatesSubmissionApplied
} from '$lib/server/discord-webhook';
import {
	clearAllTranslationAutoCheckForGame,
	disableGameAndTranslationAutoCheck,
	resolveGameAutoCheckForWebsite
} from '$lib/server/game-auto-check';
import { touchGameUpdatedToday } from '$lib/server/game-updates';
import {
	deleteGameTranslationsFromGoogleSheet,
	syncGameTranslationsToGoogleSheet
} from '$lib/server/google-sheets-sync';
import { hasPermission } from '$lib/server/permissions';
import { resolveShouldCreateSubmissionForUser } from '$lib/server/role-edit-mode';
import { createGameDeleteSubmission, createGameUpdateSubmission } from '$lib/server/submissions';
import { incrementUserGameCounter } from '$lib/server/user-stats-counters';
import { needsF95VersionBump, normalizeCheckerVersion } from '$lib/utils/f95-checker-alignment';
import { gameImageRequiredForWebsite } from '$lib/utils/game-form-validation';
import { validateGameLinkFields } from '$lib/utils/link-validation';
import { json } from '@sveltejs/kit';
import { and, asc, eq, inArray, or } from 'drizzle-orm';
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
				tname: table.gameTranslation.tname,
				gameType: table.gameTranslation.gameType,
				ac: table.gameTranslation.ac,
				createdAt: table.gameTranslation.createdAt,
				updatedAt: table.gameTranslation.updatedAt
			})
			.from(table.gameTranslation)
			.where(eq(table.gameTranslation.gameId, gameId))
			.orderBy(asc(table.gameTranslation.createdAt));

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
			website,
			threadId,
			tags,
			link,
			image,
			directMode,
			silentMode,
			gameAutoCheck,
			gameVersion,
			f95VersionRefresh
		} = body;

		const isF95VersionRefresh = Boolean(f95VersionRefresh);

		const imageValue = typeof image === 'string' ? image.trim() : '';

		// Valider les données requises (le moteur est par traduction ; `type` optionnel = appliquer à toutes les lignes si fourni, ex. refresh F95)
		if (!name || !website) {
			return json({ error: 'Nom et site web sont requis' }, { status: 400 });
		}
		if (!imageValue && gameImageRequiredForWebsite(website)) {
			return json({ error: 'Nom, site web et image sont requis' }, { status: 400 });
		}

		const gameLinkError = validateGameLinkFields({
			link: typeof link === 'string' ? link.trim() : '',
			image: imageValue,
			requireLink: true,
			requireImage: gameImageRequiredForWebsite(website)
		});
		if (gameLinkError) {
			return json({ error: gameLinkError }, { status: 400 });
		}

		// Vérifier que le jeu existe
		const existingGameRows = await db
			.select({
				id: table.game.id,
				name: table.game.name,
				description: table.game.description,
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
		const canManuallyToggleGameAutoCheck = hasPermission(locals.permissions, 'games.auto_check');
		const parsedThreadId =
			threadId !== null && threadId !== undefined && threadId !== ''
				? parseInt(String(threadId), 10)
				: null;
		const nextThreadId =
			parsedThreadId !== null && !Number.isNaN(parsedThreadId) ? parsedThreadId : null;
		const nextGameVersion =
			typeof gameVersion === 'string' && gameVersion.trim() ? gameVersion.trim() : null;

		const textFieldChanged = (next: unknown, prev: string | null | undefined) =>
			(typeof next === 'string' ? next.trim() : '') !== (prev ?? '').trim();

		const hasNonVersionChanges =
			!isF95VersionRefresh &&
			(textFieldChanged(name, existingGame.name) ||
				textFieldChanged(description, existingGame.description) ||
				textFieldChanged(website, existingGame.website) ||
				nextThreadId !== (existingGame.threadId ?? null) ||
				textFieldChanged(tags, existingGame.tags) ||
				textFieldChanged(link, existingGame.link) ||
				textFieldChanged(image, existingGame.image));

		const parseOptionalBoolean = (value: unknown): boolean | undefined => {
			if (typeof value === 'boolean') return value;
			if (value === 'true' || value === 1) return true;
			if (value === 'false' || value === 0) return false;
			return undefined;
		};

		const explicitGameAutoCheck = canManuallyToggleGameAutoCheck
			? parseOptionalBoolean(gameAutoCheck)
			: undefined;

		let nextGameAutoCheck: boolean;
		if (explicitGameAutoCheck !== undefined) {
			nextGameAutoCheck = resolveGameAutoCheckForWebsite(
				website,
				explicitGameAutoCheck,
				prevGameAutoCheck ?? true
			);
		} else if (hasNonVersionChanges) {
			nextGameAutoCheck = resolveGameAutoCheckForWebsite(website, false, false);
		} else {
			nextGameAutoCheck = resolveGameAutoCheckForWebsite(
				website,
				undefined,
				prevGameAutoCheck ?? true
			);
		}

		let checkerVersionUnknown = false;
		let normalizedCheckerVersion: string | null = null;
		let acTranslationsForRefresh: { ac: boolean; version: string | null }[] | null = null;

		if (isF95VersionRefresh && website === 'f95z') {
			normalizedCheckerVersion = normalizeCheckerVersion(nextGameVersion);
			acTranslationsForRefresh = await db
				.select({
					ac: table.gameTranslation.ac,
					version: table.gameTranslation.version
				})
				.from(table.gameTranslation)
				.where(eq(table.gameTranslation.gameId, gameId));

			if (!normalizedCheckerVersion) {
				checkerVersionUnknown = true;
				nextGameAutoCheck = false;
			} else if (explicitGameAutoCheck !== undefined) {
				nextGameAutoCheck = resolveGameAutoCheckForWebsite(
					website,
					explicitGameAutoCheck,
					prevGameAutoCheck ?? true
				);
			} else {
				nextGameAutoCheck = resolveGameAutoCheckForWebsite(
					website,
					undefined,
					prevGameAutoCheck ?? true
				);
			}
		}

		const dbGameVersion = checkerVersionUnknown
			? existingGame.gameVersion
			: isF95VersionRefresh && normalizedCheckerVersion
				? normalizedCheckerVersion
				: nextGameVersion;
		const useDirectMode = directMode !== undefined ? directMode : (currentUser.directMode ?? true);
		const shouldCreateSubmission = await resolveShouldCreateSubmissionForUser({
			roleSlug: userRole,
			userDirectMode: currentUser.directMode ?? true,
			requestDirectMode: directMode !== undefined ? useDirectMode : undefined
		});

		if (shouldCreateSubmission) {
			await createGameUpdateSubmission(currentUser.id, gameId, {
				name,
				description: description || null,
				website,
				threadId: nextThreadId,
				tags: tags || null,
				link: link || null,
				image,
				gameAutoCheck: nextGameAutoCheck,
				gameVersion: dbGameVersion
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
				website,
				threadId: threadId ? parseInt(threadId) : null,
				tags: tags || null,
				link: link || null,
				image,
				gameAutoCheck: nextGameAutoCheck,
				gameVersion: dbGameVersion,
				updatedAt: new Date()
			})
			.where(eq(table.game.id, gameId));

		if (checkerVersionUnknown) {
			await disableGameAndTranslationAutoCheck(gameId);
		} else if (!nextGameAutoCheck) {
			await clearAllTranslationAutoCheckForGame(gameId);
		} else if (
			isF95VersionRefresh &&
			normalizedCheckerVersion &&
			acTranslationsForRefresh &&
			needsF95VersionBump(
				normalizedCheckerVersion,
				existingGame.gameVersion,
				acTranslationsForRefresh
			)
		) {
			await db
				.update(table.gameTranslation)
				.set({ version: normalizedCheckerVersion, updatedAt: new Date() })
				.where(and(eq(table.gameTranslation.gameId, gameId), eq(table.gameTranslation.ac, true)));
		}
		void syncGameTranslationsToGoogleSheet(gameId).catch((err) => {
			console.warn('[google-sheets-sync] game update rows failed:', err);
		});
		if (!isSilentMode) {
			await touchGameUpdatedToday(gameId);
		}
		await incrementUserGameCounter(currentUser.id, 'edit', 1);

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
		const useDirectMode = directMode !== undefined ? directMode : (currentUser.directMode ?? true);
		const shouldCreateSubmission = await resolveShouldCreateSubmissionForUser({
			roleSlug: userRole,
			userDirectMode: currentUser.directMode ?? true,
			requestDirectMode: directMode !== undefined ? useDirectMode : undefined
		});

		if (shouldCreateSubmission) {
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
		const gameSnapshot = await db
			.select()
			.from(table.game)
			.where(eq(table.game.id, gameId))
			.limit(1);
		const translationsSnapshot = await db
			.select()
			.from(table.gameTranslation)
			.where(eq(table.gameTranslation.gameId, gameId));

		if (gameSnapshot.length > 0) {
			const g = gameSnapshot[0];
			const dataJson = JSON.stringify({
				gameId,
				reason,
				originalGame: {
					name: g.name,
					description: g.description,
					website: g.website,
					threadId: g.threadId,
					tags: g.tags,
					link: g.link,
					image: g.image,
					gameAutoCheck: g.gameAutoCheck ?? true,
					gameVersion: g.gameVersion ?? null
				},
				originalTranslations: translationsSnapshot.map((t) => ({
					translationName: t.translationName,
					version: t.version,
					tversion: t.tversion,
					status: t.status,
					ttype: t.ttype,
					tlink: t.tlink,
					tname: t.tname,
					translatorId: t.translatorId,
					proofreaderId: t.proofreaderId,
					ac: t.ac,
					gameType: t.gameType
				}))
			});
			void sendDiscordWebhookUpdatesSubmissionApplied({
				submissionId: gameId,
				submissionType: 'delete',
				dataJson,
				adminNotes: reason
			});
		}

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
		await incrementUserGameCounter(currentUser.id, 'edit', 1);
		return json({ message: 'Jeu supprimé avec succès' });
	} catch (error) {
		console.error('Erreur lors de la suppression du jeu:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
