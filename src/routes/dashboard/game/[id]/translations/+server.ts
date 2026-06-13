import { appLogError, appLogWarn } from '$lib/server/app-log-bridge';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { randomUUID } from 'node:crypto';
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
	deleteGameTranslationsFromGoogleSheet,
	voidSyncTranslationToGoogleSheet,
	voidSyncTranslatorActivityCountsToGoogleSheet
} from '$lib/server/google-sheets-sync';
import { hasPermission } from '$lib/server/permissions';
import { createTranslationDeleteSubmission, createTranslationSubmission } from '$lib/server/submissions';
import { incrementUserGameCounter } from '$lib/server/user-stats-counters';
import { validateTranslationLinkField } from '$lib/utils/link-validation';
import { normalizeNullableHistoryString } from '$lib/utils/normalize-nullable-string';
import { json } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
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
		const createdId = randomUUID();
		await db.insert(table.gameTranslation).values({
			id: createdId,
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
		});

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
				submissionId: createdId,
				submissionType: 'translation',
				dataJson,
				translationWasUpdate: false,
				adminNotes: null
			});
		}
		voidSyncTranslationToGoogleSheet(createdId, 'dashboard/add-translation');
		voidSyncTranslatorActivityCountsToGoogleSheet(translatorId, proofreaderId);
		await incrementUserGameCounter(currentUser.id, 'add', 1);

		return json({ message: 'Traduction créée avec succès' }, { status: 201 });
	} catch (error) {
		appLogError('system', 'Création traduction dashboard échouée', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};

// DELETE - Supprimer toutes les traductions d'un jeu
export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	await assertGameManageAccess(locals);

	const gameId = params.id;
	if (!gameId) return json({ error: 'ID du jeu requis' }, { status: 400 });

	try {
		let deleteBody: { reason?: string; directMode?: boolean } = {};
		try {
			const bodyText = await request.text();
			if (bodyText) deleteBody = JSON.parse(bodyText) as { reason?: string; directMode?: boolean };
		} catch {
			return json({ error: 'Corps de requête invalide' }, { status: 400 });
		}

		const reason = typeof deleteBody.reason === 'string' ? deleteBody.reason.trim() : '';
		if (!reason) return json({ error: 'La raison de la suppression est obligatoire' }, { status: 400 });

		const game = await db
			.select({ id: table.game.id })
			.from(table.game)
			.where(eq(table.game.id, gameId))
			.limit(1);
		if (game.length === 0) return json({ error: 'Jeu non trouvé' }, { status: 404 });

		const allTranslations = await db
			.select({
				id: table.gameTranslation.id,
				translatorId: table.gameTranslation.translatorId,
				proofreaderId: table.gameTranslation.proofreaderId
			})
			.from(table.gameTranslation)
			.where(eq(table.gameTranslation.gameId, gameId));

		if (allTranslations.length === 0) {
			return json({ error: 'Aucune traduction à supprimer' }, { status: 400 });
		}

		const currentUser = await loadCurrentUserOrThrow(locals.user!.id);
		const writeModeParams = {
			roleSlug: currentUser.role,
			userDirectMode: currentUser.directMode ?? true,
			requestDirectMode: parseRequestDirectMode(deleteBody.directMode)
		};
		const writeMode = await resolveGameWriteMode(writeModeParams);

		if (writeMode === 'submission') {
			for (const tr of allTranslations) {
				await createTranslationDeleteSubmission(currentUser.id, gameId, tr.id, reason);
			}
			void sendDiscordWebhookAdminNewSubmission({ submitterName: currentUser.username, gameId });
			return json({
				message: 'Soumissions de suppression créées. Elles seront examinées par un administrateur.',
				submission: true
			});
		}

		await assertDirectGameWriteAllowed(writeModeParams);

		const translationIds = allTranslations.map((t) => t.id);
		const contributorIds = allTranslations.flatMap((t) => [t.translatorId, t.proofreaderId]);
		const rejectionNote = `Rejet automatique : toutes les traductions supprimées (raison : ${reason}).`;

		await db.transaction(async (tx) => {
			await tx
				.update(table.submission)
				.set({ status: 'rejected', adminNotes: rejectionNote, updatedAt: new Date() })
				.where(
					and(
						eq(table.submission.status, 'pending'),
						inArray(table.submission.translationId, translationIds)
					)
				);
			await tx
				.update(table.submission)
				.set({ translationId: null, updatedAt: new Date() })
				.where(inArray(table.submission.translationId, translationIds));
			await tx.delete(table.gameTranslation).where(eq(table.gameTranslation.gameId, gameId));
		});

		void deleteGameTranslationsFromGoogleSheet(translationIds).catch((err) => {
			appLogWarn('sheets-sync', 'delete all translations rows failed', err);
		});
		voidSyncTranslatorActivityCountsToGoogleSheet(...contributorIds);

		void sendDiscordWebhookUpdatesSubmissionApplied({
			submissionId: gameId,
			submissionType: 'delete',
			dataJson: JSON.stringify({ gameId, reason, deletedCount: translationIds.length }),
			adminNotes: reason
		});

		return json({ message: 'Toutes les traductions ont été supprimées' });
	} catch (error) {
		appLogError('system', 'Suppression toutes traductions échouée', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
