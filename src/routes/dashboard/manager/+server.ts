import { appLogError } from '$lib/server/app-log-bridge';
import { db } from '$lib/server/db';
import { enginesPerGameSubquery, parseEngineTypes } from '$lib/server/db/engines-per-game-subquery';
import * as table from '$lib/server/db/schema';
import {
	sendDiscordWebhookAdminNewSubmission,
	sendDiscordWebhookUpdatesSubmissionApplied
} from '$lib/server/discord-webhook';
import {
	clampTranslationAc,
	gameAutoCheckEnabledForWebsite,
	resolveGameAutoCheckForWebsite
} from '$lib/server/game-auto-check';
import { translateTextToFrench } from '$lib/server/game-description-fr';
import { coerceGameEngineType } from '$lib/server/game-engine-type';
import {
	assertDirectGameWriteAllowed,
	assertGameManageAccess,
	loadCurrentUserOrThrow,
	parseRequestDirectMode,
	resolveGameWriteMode
} from '$lib/server/game-manage-guard';
import {
	voidSyncTranslationToGoogleSheet,
	voidSyncTranslatorActivityCountsToGoogleSheet
} from '$lib/server/google-sheets-sync';
import { hasPermission } from '$lib/server/permissions';
import { createGameSubmission, createTranslationSubmission } from '$lib/server/submissions';
import { incrementUserGameCounter } from '$lib/server/user-stats-counters';
import {
	gameImageRequiredForWebsite,
	normalizeGameImageForStorage,
	normalizeTranslationTversion
} from '$lib/utils/game-form-validation';
import { validateGameLinkFields, validateTranslationLinkField } from '$lib/utils/link-validation';
import { json } from '@sveltejs/kit';
import { and, eq, like, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from './$types';

const normVersion = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const normalizeTranslationName = (value: unknown): string | null => {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
};

function parseOptionalBoolean(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') return value;
	if (value === 'true' || value === 1) return true;
	if (value === 'false' || value === 0) return false;
	return undefined;
}

export const GET: RequestHandler = async ({ url, locals }) => {
	await assertGameManageAccess(locals);

	const threadIdCheck = url.searchParams.get('threadIdCheck');
	if (threadIdCheck !== null) {
		const parsed = Number.parseInt(threadIdCheck, 10);
		if (Number.isNaN(parsed) || parsed <= 0) {
			return json({ gameExists: false, pendingSubmission: false });
		}

		try {
			const existingGame = await db
				.select({ id: table.game.id, name: table.game.name })
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
						sql`JSON_VALUE(${table.submission.data}, '$.game.threadId') IS NOT NULL AND CAST(JSON_VALUE(${table.submission.data}, '$.game.threadId') AS UNSIGNED) = ${parsed}`
					)
				)
				.limit(1);

			let existingTranslations: Array<{
				id: string;
				tname: string;
				tversion: string;
				status: string;
				ttype: string;
				translationName: string | null;
			}> = [];

			if (existingGame.length > 0) {
				existingTranslations = await db
					.select({
						id: table.gameTranslation.id,
						tname: table.gameTranslation.tname,
						tversion: table.gameTranslation.tversion,
						status: table.gameTranslation.status,
						ttype: table.gameTranslation.ttype,
						translationName: table.gameTranslation.translationName
					})
					.from(table.gameTranslation)
					.where(eq(table.gameTranslation.gameId, existingGame[0].id));
			}

			return json({
				gameExists: existingGame.length > 0,
				pendingSubmission: pendingGameSubmission.length > 0,
				existingGameId: existingGame.length > 0 ? existingGame[0].id : undefined,
				existingTranslations: existingGame.length > 0 ? existingTranslations : undefined
			});
		} catch (error) {
			appLogError('scrape', 'Vérification thread manager échouée', error);
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
			? like(table.game.name, `%${query}%`)
			: or(like(table.game.name, `%${query}%`), eq(table.game.threadId, threadIdQuery));
		const enginesSq = enginesPerGameSubquery();
		const rawGames = await db
			.select({
				id: table.game.id,
				name: table.game.name,
				description: table.game.description,
				website: table.game.website,
				threadId: table.game.threadId,
				link: table.game.link,
				tags: table.game.tags,
				engineTypes: enginesSq.engineTypes,
				image: table.game.image,
				createdAt: table.game.createdAt,
				updatedAt: table.game.updatedAt
			})
			.from(table.game)
			.leftJoin(enginesSq, eq(table.game.id, enginesSq.gameId))
			.where(whereClause)
			.orderBy(table.game.name)
			.limit(20);

		const games = rawGames.map(({ engineTypes, ...rest }) => ({
			...rest,
			engineTypes: parseEngineTypes(engineTypes)
		}));

		return json({ games });
	} catch (error) {
		appLogError('system', 'Recherche jeux manager échouée', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	await assertGameManageAccess(locals);

	try {
		const body = await request.json();
		const { game, translation, directMode, pendingNewTranslators } = body;
		const addTranslationToExistingGame = Boolean(body.addTranslationToExistingGame);

		// Extraire les données du jeu
		const { name, description, type, website, threadId, tags, link, image, gameVersion } = game;
		const scrapeUnchanged = Boolean(game?.scrapeUnchanged);
		const canSetAutoCheck = hasPermission(locals, 'games.auto_check');
		const scrapeDefaultAutoCheck = gameAutoCheckEnabledForWebsite(website) && scrapeUnchanged;
		const nextGameAutoCheck = resolveGameAutoCheckForWebsite(
			website,
			canSetAutoCheck ? parseOptionalBoolean(game?.gameAutoCheck) : undefined,
			scrapeDefaultAutoCheck
		);
		const translationTname = typeof translation?.tname === 'string' ? translation.tname.trim() : '';
		const isIntegratedTranslation = translationTname === 'integrated';
		const translationIsNoTranslation = translationTname === 'no_translation';
		const inferredTranslationAc =
			nextGameAutoCheck &&
			(translationIsNoTranslation ||
				isIntegratedTranslation ||
				(normVersion(translation?.version).length > 0 &&
					normVersion(translation?.version) === normVersion(gameVersion)));
		const requestedTranslationAc = parseOptionalBoolean(translation?.ac);
		const nextTranslationAc =
			translation && canSetAutoCheck && requestedTranslationAc !== undefined
				? clampTranslationAc(nextGameAutoCheck, requestedTranslationAc)
				: inferredTranslationAc;

		// Mode : ajouter une traduction à un jeu existant (ne pas recréer le jeu)
		if (addTranslationToExistingGame) {
			const parsedTid =
				threadId !== null && threadId !== undefined && threadId !== ''
					? Number.parseInt(String(threadId), 10)
					: null;
			const validTid =
				parsedTid !== null && !Number.isNaN(parsedTid) && parsedTid > 0 ? parsedTid : null;

			if (validTid === null) {
				return json(
					{ error: 'Thread ID requis pour ajouter une traduction à un jeu existant' },
					{ status: 400 }
				);
			}

			const existingGameRow = await db
				.select({ id: table.game.id, name: table.game.name })
				.from(table.game)
				.where(eq(table.game.threadId, validTid))
				.limit(1);

			if (existingGameRow.length === 0) {
				return json({ error: 'Aucun jeu trouvé avec cet ID de thread' }, { status: 404 });
			}

			if (!translation || translationIsNoTranslation) {
				return json({ error: 'Données de traduction manquantes' }, { status: 400 });
			}

			const translationLinkError = validateTranslationLinkField({
				tlink: translation.tlink,
				tname: translationTname
			});
			if (translationLinkError) {
				return json({ error: translationLinkError }, { status: 400 });
			}

			const normalizedTversionExisting = normalizeTranslationTversion(
				translationTname,
				translation.tversion
			);
			if (!isIntegratedTranslation && !normalizedTversionExisting) {
				return json({ error: 'La version de traduction est obligatoire' }, { status: 400 });
			}

			const currentUserExisting = await loadCurrentUserOrThrow(locals.user!.id);
			const writeModeParamsExisting = {
				roleSlug: currentUserExisting.role,
				userDirectMode: currentUserExisting.directMode ?? true,
				requestDirectMode: parseRequestDirectMode(directMode)
			};
			const writeModeExisting = await resolveGameWriteMode(writeModeParamsExisting);

			const pendingTranslatorNamesExisting = Array.isArray(pendingNewTranslators)
				? pendingNewTranslators
						.filter((n): n is string => typeof n === 'string')
						.map((n) => n.trim())
						.filter((n) => n.length > 0)
				: [];

			const targetGameId = existingGameRow[0].id;
			const targetGameName = existingGameRow[0].name;
			const resolvedGameType =
				typeof translation.gameType === 'string' && translation.gameType.trim()
					? translation.gameType.trim()
					: typeof type === 'string' && type.trim()
						? type.trim()
						: 'other';

			if (writeModeExisting === 'submission') {
				await createTranslationSubmission(
					currentUserExisting.id,
					targetGameId,
					{
						translationName: normalizeTranslationName(translation.translationName),
						version:
							typeof translation.version === 'string' ? translation.version.trim() || null : null,
						tversion: normalizedTversionExisting,
						status: translation.status,
						ttype: translation.ttype,
						tlink: translation.tlink || '',
						gameType: resolvedGameType,
						translatorId: translation.translatorId || null,
						proofreaderId: translation.proofreaderId || null,
						ac: nextTranslationAc
					},
					pendingTranslatorNamesExisting.length > 0 ? pendingTranslatorNamesExisting : undefined
				);
				void sendDiscordWebhookAdminNewSubmission({
					submitterName: currentUserExisting.username,
					gameName: targetGameName,
					gameImage: undefined
				});
				return json({
					message:
						'Soumission de traduction créée avec succès. Elle sera examinée par un administrateur.',
					submission: true
				});
			}

			if (pendingTranslatorNamesExisting.length > 0) {
				return json(
					{
						error:
							'Les nouveaux traducteurs proposés ne peuvent être enregistrés que via une soumission.'
					},
					{ status: 400 }
				);
			}

			await assertDirectGameWriteAllowed(writeModeParamsExisting);

			const newTranslationId = randomUUID();
			await db.insert(table.gameTranslation).values({
				id: newTranslationId,
				gameId: targetGameId,
				translationName: normalizeTranslationName(translation.translationName),
				version:
					typeof translation.version === 'string' ? translation.version.trim() || null : null,
				tversion: normalizedTversionExisting,
				status: translation.status,
				ttype: translation.ttype,
				tname:
					(translation.tname as
						| 'no_translation'
						| 'integrated'
						| 'translation'
						| 'translation_with_mods') || 'translation',
				gameType: coerceGameEngineType(resolvedGameType),
				tlink: translation.tlink || '',
				translatorId: translation.translatorId || null,
				proofreaderId: translation.proofreaderId || null,
				ac: nextTranslationAc,
				createdAt: new Date(),
				updatedAt: new Date()
			});

			voidSyncTranslationToGoogleSheet(newTranslationId, 'manager/add-translation-to-existing');
			voidSyncTranslatorActivityCountsToGoogleSheet(
				translation?.translatorId,
				translation?.proofreaderId
			);
			await incrementUserGameCounter(currentUserExisting.id, 'add', 1);

			return json({
				message: 'Traduction ajoutée avec succès',
				gameId: targetGameId,
				translationId: newTranslationId
			});
		}

		// Valider les données requises
		if (!name || !type || !website) {
			return json({ error: 'Nom, type et site web sont requis' }, { status: 400 });
		}

		const imageValue = normalizeGameImageForStorage(website, image, {
			gameAutoCheck: nextGameAutoCheck
		});
		const requireImage = gameImageRequiredForWebsite(website, {
			gameAutoCheck: nextGameAutoCheck,
			lcScrapeProvidedImage: website === 'lc' && Boolean(imageValue)
		});
		if (!imageValue && requireImage) {
			return json({ error: 'Nom, type, site web et image sont requis' }, { status: 400 });
		}

		const linkValue = typeof link === 'string' ? link.trim() : '';
		const gameLinkError = validateGameLinkFields({
			link: linkValue,
			image: imageValue,
			requireLink: true,
			requireImage
		});
		if (gameLinkError) {
			return json({ error: gameLinkError }, { status: 400 });
		}

		if (translation && !translationIsNoTranslation) {
			const translationLinkError = validateTranslationLinkField({
				tlink: translation.tlink,
				tname: translationTname
			});
			if (translationLinkError) {
				return json({ error: translationLinkError }, { status: 400 });
			}
			const normalizedTversion = normalizeTranslationTversion(
				translationTname,
				translation.tversion
			);
			if (!isIntegratedTranslation && !normalizedTversion) {
				return json({ error: 'La version de traduction est obligatoire' }, { status: 400 });
			}
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
						sql`JSON_VALUE(data, '$.game.threadId') IS NOT NULL AND CAST(JSON_VALUE(data, '$.game.threadId') AS UNSIGNED) = ${validThreadId}`
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

		const currentUser = await loadCurrentUserOrThrow(locals.user!.id);
		const userRole = currentUser.role;
		const explicitDirectMode = parseRequestDirectMode(directMode);
		const writeModeParams = {
			roleSlug: userRole,
			userDirectMode: currentUser.directMode ?? true,
			requestDirectMode: explicitDirectMode
		};
		const writeMode = await resolveGameWriteMode(writeModeParams);

		const pendingTranslatorNames = Array.isArray(pendingNewTranslators)
			? pendingNewTranslators
					.filter((n): n is string => typeof n === 'string')
					.map((n) => n.trim())
					.filter((n) => n.length > 0)
			: [];

		if (writeMode === 'submission') {
			// Créer une soumission pour les traducteurs ou superadmins en mode soumission
			await createGameSubmission(
				currentUser.id,
				{
					name,
					description: description || null,
					type,
					website,
					threadId: validThreadId,
					tags: typeof tags === 'string' ? tags.trim() || '' : '',
					link: linkValue,
					image: imageValue,
					gameAutoCheck: nextGameAutoCheck,
					gameVersion:
						typeof gameVersion === 'string' && gameVersion.trim() ? gameVersion.trim() : null
				},
				translation && !translationIsNoTranslation
					? {
							translationName: normalizeTranslationName(translation.translationName),
							version:
								typeof translation.version === 'string' ? translation.version.trim() || null : null,
							tversion: normalizeTranslationTversion(translationTname, translation.tversion),
							status: translation.status,
							ttype: translation.ttype,
							tlink: translation.tlink || null,
							tname: translation.tname || null,
							gameType:
								typeof translation.gameType === 'string' && translation.gameType.trim()
									? translation.gameType.trim()
									: String(type),
							translatorId: translation.translatorId || null,
							proofreaderId: translation.proofreaderId || null,
							ac: nextTranslationAc
						}
					: undefined,
				pendingTranslatorNames.length > 0 ? pendingTranslatorNames : undefined
			);
			void sendDiscordWebhookAdminNewSubmission({
				submitterName: currentUser.username,
				gameName: name,
				gameImage: imageValue || undefined
			});

			return json({
				message: 'Soumission créée avec succès. Elle sera examinée par un administrateur.',
				submission: true
			});
		}

		if (pendingTranslatorNames.length > 0) {
			return json(
				{
					error:
						'Les nouveaux traducteurs proposés ne peuvent être enregistrés que via une soumission.'
				},
				{ status: 400 }
			);
		}

		await assertDirectGameWriteAllowed(writeModeParams);

		const normalizedDescription =
			typeof description === 'string' && description.trim() ? description.trim() : null;

		// Mode direct (rôle + permission vérifiés côté serveur)
		const shouldCreateTranslation = Boolean(translation) && !translationIsNoTranslation;
		const normalizedTranslationTversion = shouldCreateTranslation
			? normalizeTranslationTversion(translationTname, translation?.tversion)
			: '';

		const { gameId, createdTranslationId } = await db.transaction(async (tx) => {
			const newGameId = randomUUID();
			await tx.insert(table.game).values({
				id: newGameId,
				name,
				description: normalizedDescription,
				descriptionFr: null,
				website,
				threadId: validThreadId,
				tags: typeof tags === 'string' ? tags.trim() || '' : '',
				link: linkValue,
				image: imageValue,
				gameAutoCheck: nextGameAutoCheck,
				gameVersion:
					typeof gameVersion === 'string' && gameVersion.trim() ? gameVersion.trim() : null,
				createdAt: new Date(),
				updatedAt: new Date()
			});

			let newTranslationId: string | undefined;
			if (shouldCreateTranslation && translation) {
				newTranslationId = randomUUID();
				await tx.insert(table.gameTranslation).values({
					id: newTranslationId,
					gameId: newGameId,
					translationName: normalizeTranslationName(translation.translationName),
					version:
						typeof translation.version === 'string' ? translation.version.trim() || null : null,
					tversion: normalizedTranslationTversion,
					status: translation.status,
					ttype: translation.ttype,
					tname:
						(translation.tname as
							| 'no_translation'
							| 'integrated'
							| 'translation'
							| 'translation_with_mods') || 'translation',
					gameType: coerceGameEngineType(
						typeof translation.gameType === 'string' && translation.gameType.trim()
							? translation.gameType
							: type
					),
					tlink: translation.tlink || '',
					translatorId: translation.translatorId || null,
					proofreaderId: translation.proofreaderId || null,
					ac: nextTranslationAc,
					createdAt: new Date(),
					updatedAt: new Date()
				});
			}

			return { gameId: newGameId, createdTranslationId: newTranslationId };
		});

		if (normalizedDescription) {
			void translateTextToFrench(normalizedDescription).then((fr) => {
				if (fr)
					db.update(table.game)
						.set({ descriptionFr: fr })
						.where(eq(table.game.id, gameId))
						.catch((err) =>
							console.warn('[manager/add] background translation update failed', err)
						);
			});
		}

		if (shouldCreateTranslation && createdTranslationId) {
			voidSyncTranslationToGoogleSheet(createdTranslationId, 'manager/create-game');
			voidSyncTranslatorActivityCountsToGoogleSheet(
				translation?.translatorId,
				translation?.proofreaderId
			);
		}

		if (gameId) {
			const dataJson = JSON.stringify({
				gameId,
				translationId: createdTranslationId,
				game: {
					name,
					image: imageValue,
					link: link || null,
					threadId: validThreadId,
					website
				},
				translation: translation
					? {
							translationName: normalizeTranslationName(translation.translationName),
							version:
								typeof translation.version === 'string' ? translation.version.trim() || null : null,
							tversion: translation.tversion,
							translatorId: translation.translatorId || null
						}
					: undefined
			});
			void sendDiscordWebhookUpdatesSubmissionApplied({
				submissionId: gameId,
				submissionType: 'game',
				dataJson
			});
		}

		await incrementUserGameCounter(
			currentUser.id,
			'add',
			shouldCreateTranslation && createdTranslationId ? 2 : 1
		);
		if (shouldCreateTranslation && !createdTranslationId) {
			appLogError('system', 'manager/add : traduction attendue mais non créée', undefined, {
				translationTname,
				hasTranslationPayload: Boolean(translation)
			});
			return json(
				{
					error:
						'Le jeu a été créé mais la traduction n’a pas pu être enregistrée. Vérifiez les champs de traduction.'
				},
				{ status: 500 }
			);
		}

		return json({
			message:
				shouldCreateTranslation && createdTranslationId
					? 'Jeu et traduction ajoutés avec succès'
					: 'Jeu ajouté avec succès',
			gameId: gameId,
			translationId: createdTranslationId ?? null
		});
	} catch (error) {
		appLogError('system', 'Ajout jeu manager échoué', error);
		if (error instanceof Error && error.message === 'GAME_INSERT_FAILED') {
			return json({ error: 'Impossible de créer le jeu' }, { status: 500 });
		}
		if (error instanceof Error && error.message === 'TRANSLATION_INSERT_FAILED') {
			return json(
				{ error: 'Le jeu a été créé mais la traduction n’a pas pu être enregistrée' },
				{ status: 500 }
			);
		}
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
