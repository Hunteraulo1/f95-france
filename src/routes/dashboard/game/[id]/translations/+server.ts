import { appLogError } from '$lib/server/app-log-bridge';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
    sendDiscordWebhookAdminNewSubmission,
    sendDiscordWebhookUpdatesSubmissionApplied
} from '$lib/server/discord-webhook';
import { coerceGameEngineType, defaultGameTypeForGame } from '$lib/server/game-engine-type';
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
import { createTranslationSubmission } from '$lib/server/submissions';
import { incrementUserGameCounter } from '$lib/server/user-stats-counters';
import { validateTranslationLinkField } from '$lib/utils/link-validation';
import { normalizeNullableHistoryString } from '$lib/utils/normalize-nullable-string';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const normVersion = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

// POST - Créer une nouvelle traduction
export const POST: RequestHandler = async ({ params, request, locals }) => {
	await assertGameManageAccess(locals);

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
			gameType: gameTypeBody,
			directMode,
			silentMode,
			translatorId,
			proofreaderId,
			pendingNewTranslators
		} = body;

		// Validation des données requises
		// Le lien n'est pas requis pour les traductions intégrées ou "pas de traduction"
		const linkNotRequired = tname === 'integrated' || tname === 'no_translation';
		const requiresTranslationVersion = tname !== 'no_translation';
		if (
			(requiresTranslationVersion && !tversion) ||
			!status ||
			!ttype ||
			(!linkNotRequired && !tlink)
		) {
			return json(
				{
					error: linkNotRequired
						? requiresTranslationVersion
							? 'Les champs Version de traduction, Statut et Type sont requis'
							: 'Les champs Statut et Type sont requis'
						: 'Tous les champs sont requis'
				},
				{ status: 400 }
			);
		}

		// Vérifier que le jeu existe
		const game = await db
			.select({
				id: table.game.id,
				gameAutoCheck: table.game.gameAutoCheck,
				gameVersion: table.game.gameVersion
			})
			.from(table.game)
			.where(eq(table.game.id, gameId))
			.limit(1);

		if (game.length === 0) {
			return json({ error: 'Jeu non trouvé' }, { status: 404 });
		}

		const tnameNorm = typeof tname === 'string' && tname.length > 0 ? tname : 'translation';
		const translationLinkError = validateTranslationLinkField({ tlink, tname: tnameNorm });
		if (translationLinkError) {
			return json({ error: translationLinkError }, { status: 400 });
		}

		const gv = normVersion(game[0].gameVersion);
		const vv = normVersion(version);
		/** Règle auto-check: true si version ref = version jeu, ou traduction intégrée, ou pas de traduction. */
		const acValue =
			game[0].gameAutoCheck === true &&
			(tnameNorm === 'integrated' ||
				tnameNorm === 'no_translation' ||
				(gv.length > 0 && vv === gv));

		const currentUser = await loadCurrentUserOrThrow(locals.user!.id);
		const userRole = currentUser.role;
		const canUseSilentMode = hasPermission(locals, 'games.silent_mode');
		const isSilentMode = canUseSilentMode && Boolean(silentMode);
		const writeModeParams = {
			roleSlug: userRole,
			userDirectMode: currentUser.directMode ?? true,
			requestDirectMode: parseRequestDirectMode(directMode)
		};
		const writeMode = await resolveGameWriteMode(writeModeParams);

		if (writeMode === 'submission') {
			const pendingNames = Array.isArray(pendingNewTranslators)
				? pendingNewTranslators
						.filter((n): n is string => typeof n === 'string')
						.map((n) => n.trim())
						.filter((n) => n.length > 0)
				: [];

			await createTranslationSubmission(
				currentUser.id,
				gameId,
				{
					translationName: normalizeNullableHistoryString(translationName),
					version: typeof version === 'string' ? version.trim() || null : null,
					tversion,
					status,
					ttype,
					tlink,
					...(typeof gameTypeBody === 'string' && gameTypeBody.trim()
						? { gameType: gameTypeBody.trim() }
						: {}),
					translatorId: translatorId || null,
					proofreaderId: proofreaderId || null,
					ac: acValue
				},
				pendingNames.length > 0 ? pendingNames : undefined
			);
			if (!isSilentMode) {
				void sendDiscordWebhookAdminNewSubmission({
					submitterName: currentUser.username,
					gameId
				});
			}

			return json(
				{
					message: 'Soumission créée avec succès. Elle sera examinée par un administrateur.',
					submission: true
				},
				{ status: 201 }
			);
		}

		await assertDirectGameWriteAllowed(writeModeParams);

		// Mode direct (rôle vérifié côté serveur)
		// Pour les traductions intégrées ou "pas de traduction", le lien doit être une chaîne vide
		// (le champ est NOT NULL dans le schéma, donc on utilise '' au lieu de null)
		const tlinkStored = linkNotRequired || tlink === null ? '' : tlink || '';
		const engineTr =
			typeof gameTypeBody === 'string' && gameTypeBody.trim()
				? coerceGameEngineType(gameTypeBody)
				: await defaultGameTypeForGame(gameId);
		const [created] = await db
			.insert(table.gameTranslation)
			.values({
				gameId,
				translationName,
				version: typeof version === 'string' ? version.trim() || null : null,
				tversion,
				status,
				ttype,
				gameType: engineTr,
				tlink: tlinkStored,
				tname:
					(tname as 'no_translation' | 'integrated' | 'translation' | 'translation_with_mods') ||
					'translation',
				translatorId: translatorId || null,
				proofreaderId: proofreaderId || null,
				ac: acValue
			})
			.returning({ id: table.gameTranslation.id });

		const dataJson = JSON.stringify({
			gameId,
			translation: {
				translationName: normalizeNullableHistoryString(translationName),
				version: typeof version === 'string' ? version.trim() || null : null,
				tversion,
				status,
				ttype,
				tlink: tlinkStored,
				translatorId: translatorId || null,
				proofreaderId: proofreaderId || null,
				ac: acValue
			}
		});
		if (!isSilentMode) {
			void sendDiscordWebhookUpdatesSubmissionApplied({
				submissionId: created?.id ?? 'direct-translation',
				submissionType: 'translation',
				dataJson,
				translationWasUpdate: false,
				adminNotes: null
			});
		}
		if (created?.id) {
			voidSyncTranslationToGoogleSheet(created.id, 'dashboard/add-translation');
		}
		voidSyncTranslatorActivityCountsToGoogleSheet(translatorId, proofreaderId);
		await incrementUserGameCounter(currentUser.id, 'add', 1);

		return json({ message: 'Traduction créée avec succès' }, { status: 201 });
	} catch (error) {
		appLogError('system', 'Création traduction dashboard échouée', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
