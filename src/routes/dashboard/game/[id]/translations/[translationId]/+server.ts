import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	sendDiscordWebhookAdminNewSubmission,
	sendDiscordWebhookUpdatesSubmissionApplied
} from '$lib/server/discord-webhook';
import { getGameAllowsTranslationAutoCheck } from '$lib/server/game-auto-check';
import { coerceGameEngineType } from '$lib/server/game-engine-type';
import {
	assertDirectGameWriteAllowed,
	assertGameManageAccess,
	loadCurrentUserOrThrow,
	parseRequestDirectMode,
	resolveGameWriteMode
} from '$lib/server/game-manage-guard';
import {
	recordTranslationChangeInUpdateHistory,
	touchGameUpdatedToday
} from '$lib/server/game-updates';
import {
	deleteTranslationFromGoogleSheet,
	voidSyncTranslationToGoogleSheet,
	voidSyncTranslatorActivityCountsToGoogleSheet
} from '$lib/server/google-sheets-sync';
import { hasPermission } from '$lib/server/permissions';
import {
	hasGameTranslationGameTypeColumn,
	publicErrorFromUnknown
} from '$lib/server/schema-column-compat';
import {
	createTranslationDeleteSubmission,
	createTranslationUpdateSubmission
} from '$lib/server/submissions';
import { resolveTranslatorAlertsEnabledOnWrite } from '$lib/server/translator-follow-alerts';
import { translationRowToHistorySnapshot } from '$lib/server/update-history';
import { incrementUserGameCounter } from '$lib/server/user-stats-counters';
import { validateTranslationLinkField } from '$lib/utils/link-validation';
import { normalizeNullableHistoryString } from '$lib/utils/normalize-nullable-string';
import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

// PUT - Modifier une traduction
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	await assertGameManageAccess(locals);

	const { id: gameId, translationId } = params;

	if (!gameId || !translationId) {
		return json({ error: 'ID du jeu et ID de traduction requis' }, { status: 400 });
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
			tname: tnameBody,
			gameType: gameTypeBody,
			directMode,
			silentMode,
			ac,
			translatorId,
			proofreaderId,
			pendingNewTranslators,
			f95VersionRefresh
		} = body;

		const isF95VersionRefresh = Boolean(f95VersionRefresh);

		const beforeRows = await db
			.select()
			.from(table.gameTranslation)
			.where(
				and(eq(table.gameTranslation.id, translationId), eq(table.gameTranslation.gameId, gameId))
			)
			.limit(1);

		if (beforeRows.length === 0) {
			return json({ error: 'Traduction non trouvée' }, { status: 404 });
		}

		const before = beforeRows[0];
		const normalizedVersion = isF95VersionRefresh
			? typeof version === 'string'
				? version.trim() || null
				: (before.version ?? null)
			: typeof version === 'string'
				? version.trim() || null
				: (before.version ?? null);

		const resolvedTranslatorId =
			'translatorId' in body ? (translatorId ? String(translatorId) : null) : before.translatorId;
		const resolvedProofreaderId =
			'proofreaderId' in body
				? proofreaderId
					? String(proofreaderId)
					: null
				: before.proofreaderId;

		const TNAMES = [
			'no_translation',
			'integrated',
			'translation',
			'translation_with_mods'
		] as const;
		const effectiveTname = TNAMES.includes(tnameBody as (typeof TNAMES)[number])
			? (tnameBody as (typeof TNAMES)[number])
			: before.tname;

		const linkNotRequired = effectiveTname === 'integrated' || effectiveTname === 'no_translation';
		const requiresTranslationVersion = effectiveTname !== 'no_translation';
		const tlinkStored = linkNotRequired
			? ''
			: typeof tlink === 'string'
				? tlink
				: (before.tlink ?? '');
		const effectiveTversion = isF95VersionRefresh ? before.tversion : tversion;
		const effectiveStatus = isF95VersionRefresh ? before.status : status;
		const effectiveTtype = isF95VersionRefresh ? before.ttype : ttype;

		if (!isF95VersionRefresh) {
			if (
				(requiresTranslationVersion && !effectiveTversion) ||
				!effectiveStatus ||
				!effectiveTtype ||
				(!linkNotRequired && !tlinkStored.trim())
			) {
				return json(
					{
						error: linkNotRequired
							? requiresTranslationVersion
								? 'Version de traduction, statut et type sont requis'
								: 'Statut et type sont requis'
							: 'Tous les champs sont requis (y compris le lien de traduction)'
					},
					{ status: 400 }
				);
			}

			const translationLinkError = validateTranslationLinkField({
				tlink: tlinkStored,
				tname: effectiveTname
			});
			if (translationLinkError) {
				return json({ error: translationLinkError }, { status: 400 });
			}
		}

		const currentUser = await loadCurrentUserOrThrow(locals.user!.id);
		const userRole = currentUser.role;
		const canUseSilentMode = hasPermission(locals, 'games.silent_mode');
		const canManuallyEditTranslationAc = hasPermission(locals, 'games.auto_check');
		const acRequested = typeof ac === 'boolean' ? ac : undefined;
		// Règle métier: si l'auto-check jeu est false, la traduction doit être false.
		// Sinon, admin/superadmin peuvent choisir la valeur ; sinon on conserve l'existante.
		const gameAllowsTranslationAc = await getGameAllowsTranslationAutoCheck(gameId);
		const acValue = isF95VersionRefresh
			? (before.ac ?? false)
			: !gameAllowsTranslationAc
				? false
				: canManuallyEditTranslationAc && acRequested !== undefined
					? acRequested
					: (before.ac ?? false);
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

			await createTranslationUpdateSubmission(
				currentUser.id,
				gameId,
				translationId,
				{
					translationName: normalizeNullableHistoryString(translationName),
					version: normalizedVersion,
					tversion,
					status,
					ttype,
					tlink: tlinkStored,
					tname: effectiveTname,
					...(typeof gameTypeBody === 'string' && gameTypeBody.trim()
						? { gameType: gameTypeBody.trim() }
						: {}),
					translatorId: resolvedTranslatorId,
					proofreaderId: resolvedProofreaderId,
					ac: acValue
				},
				pendingNames.length > 0 ? pendingNames : undefined
			);
			// La table update/MAJ doit refléter l'action dès la modification (sauf mode silencieux).
			if (!isSilentMode) {
				await touchGameUpdatedToday(gameId);
			}
			void sendDiscordWebhookAdminNewSubmission({
				submitterName: currentUser.username,
				gameId
			});

			return json({
				message: 'Soumission créée avec succès. Elle sera examinée par un administrateur.',
				submission: true
			});
		}

		const pendingNamesDirect = Array.isArray(pendingNewTranslators)
			? pendingNewTranslators
					.filter((n): n is string => typeof n === 'string')
					.map((n) => n.trim())
					.filter((n) => n.length > 0)
			: [];
		if (pendingNamesDirect.length > 0) {
			return json(
				{
					error:
						'Les nouveaux traducteurs proposés ne peuvent être enregistrés que via une soumission.'
				},
				{ status: 400 }
			);
		}

		await assertDirectGameWriteAllowed(writeModeParams);

		// Mode direct (rôle vérifié côté serveur)
		const directSet: {
			translationName: string | null;
			version: string | null;
			tversion: string;
			status: string;
			ttype: string;
			tlink: string;
			tname: (typeof before)['tname'];
			translatorId: string | null;
			proofreaderId: string | null;
			translatorAlertsEnabled: boolean;
			ac: boolean;
			updatedAt: Date;
			gameType?: (typeof before)['gameType'];
		} = {
			translationName: isF95VersionRefresh
				? before.translationName
				: normalizeNullableHistoryString(translationName),
			version: normalizedVersion,
			tversion: effectiveTversion,
			status: effectiveStatus,
			ttype: effectiveTtype,
			tlink: isF95VersionRefresh ? before.tlink : tlinkStored,
			tname: effectiveTname,
			translatorId: resolvedTranslatorId,
			proofreaderId: resolvedProofreaderId,
			translatorAlertsEnabled: resolveTranslatorAlertsEnabledOnWrite({
				beforeTranslatorId: before.translatorId,
				afterTranslatorId: resolvedTranslatorId,
				currentTranslatorAlertsEnabled: before.translatorAlertsEnabled
			}),
			ac: acValue,
			updatedAt: new Date()
		};
		if (
			typeof gameTypeBody === 'string' &&
			gameTypeBody.trim() &&
			(await hasGameTranslationGameTypeColumn())
		) {
			directSet.gameType = coerceGameEngineType(gameTypeBody);
		}
		await db
			.update(table.gameTranslation)
			.set(directSet)
			.where(
				and(eq(table.gameTranslation.id, translationId), eq(table.gameTranslation.gameId, gameId))
			);

		const dataJson = JSON.stringify({
			gameId,
			translation: {
				translationName: normalizeNullableHistoryString(translationName),
				version: normalizedVersion,
				tversion,
				status,
				ttype,
				tlink: tlinkStored,
				tname: effectiveTname,
				translatorId: translatorId || null,
				proofreaderId: proofreaderId || null,
				ac: acValue
			},
			originalTranslation: {
				translationName: before.translationName,
				version: before.version ?? null,
				tversion: before.tversion,
				status: before.status,
				ttype: before.ttype,
				tlink: before.tlink,
				tname: before.tname,
				gameType: before.gameType,
				translatorId: before.translatorId,
				proofreaderId: before.proofreaderId,
				ac: before.ac
			}
		});
		if (!isSilentMode) {
			void sendDiscordWebhookUpdatesSubmissionApplied({
				submissionId: translationId,
				submissionType: 'translation',
				dataJson,
				translationWasUpdate: true,
				adminNotes: null
			});
		}
		voidSyncTranslationToGoogleSheet(translationId, 'dashboard/update-translation');
		voidSyncTranslatorActivityCountsToGoogleSheet(
			before.translatorId,
			before.proofreaderId,
			resolvedTranslatorId,
			resolvedProofreaderId
		);
		if (!isSilentMode) {
			await recordTranslationChangeInUpdateHistory(gameId, {
				userId: currentUser.id,
				translationId,
				before: translationRowToHistorySnapshot(before),
				after: translationRowToHistorySnapshot({
					translationName: directSet.translationName,
					version: directSet.version,
					tversion: directSet.tversion,
					status: directSet.status,
					ttype: directSet.ttype,
					tlink: directSet.tlink,
					tname: directSet.tname,
					gameType: directSet.gameType ?? before.gameType,
					translatorId: directSet.translatorId,
					proofreaderId: directSet.proofreaderId,
					ac: directSet.ac
				}),
				updateKind: 'update'
			});
		}
		await incrementUserGameCounter(currentUser.id, 'edit', 1);

		return json({ message: 'Traduction modifiée avec succès' });
	} catch (error) {
		console.error('Erreur lors de la modification de la traduction:', error);
		return json(
			{ error: publicErrorFromUnknown(error, 'Erreur lors de la modification de la traduction') },
			{ status: 500 }
		);
	}
};

// DELETE - Supprimer une traduction
export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	await assertGameManageAccess(locals);

	const { id: gameId, translationId } = params;

	if (!gameId || !translationId) {
		return json({ error: 'ID du jeu et ID de traduction requis' }, { status: 400 });
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

		const trRows = await db
			.select()
			.from(table.gameTranslation)
			.where(
				and(eq(table.gameTranslation.id, translationId), eq(table.gameTranslation.gameId, gameId))
			)
			.limit(1);

		if (trRows.length === 0) {
			return json({ error: 'Traduction non trouvée' }, { status: 404 });
		}

		const tr = trRows[0];

		const currentUser = await loadCurrentUserOrThrow(locals.user!.id);
		const userRole = currentUser.role;
		const writeModeParams = {
			roleSlug: userRole,
			userDirectMode: currentUser.directMode ?? true,
			requestDirectMode: parseRequestDirectMode(directMode)
		};
		const writeMode = await resolveGameWriteMode(writeModeParams);

		if (writeMode === 'submission') {
			await createTranslationDeleteSubmission(currentUser.id, gameId, translationId, reason);
			void sendDiscordWebhookAdminNewSubmission({
				submitterName: currentUser.username,
				gameId
			});

			return json({
				message:
					'Soumission de suppression créée avec succès. Elle sera examinée par un administrateur.',
				submission: true
			});
		}

		await assertDirectGameWriteAllowed(writeModeParams);

		const dataJson = JSON.stringify({
			gameId,
			reason,
			originalTranslation: {
				translationName: tr.translationName,
				version: tr.version,
				tversion: tr.tversion,
				status: tr.status,
				ttype: tr.ttype,
				tlink: tr.tlink,
				translatorId: tr.translatorId,
				proofreaderId: tr.proofreaderId,
				ac: tr.ac
			}
		});
		void sendDiscordWebhookUpdatesSubmissionApplied({
			submissionId: translationId,
			submissionType: 'delete',
			dataJson,
			adminNotes: reason
		});

		await db.delete(table.gameTranslation).where(eq(table.gameTranslation.id, translationId));
		await recordTranslationChangeInUpdateHistory(gameId, {
			userId: currentUser.id,
			translationId,
			before: translationRowToHistorySnapshot(tr),
			after: null,
			updateKind: 'update'
		});
		void deleteTranslationFromGoogleSheet(translationId).catch((err) => {
			console.warn('[google-sheets-sync] delete translation row failed:', err);
		});
		voidSyncTranslatorActivityCountsToGoogleSheet(tr.translatorId, tr.proofreaderId);
		await incrementUserGameCounter(currentUser.id, 'edit', 1);
		return json({ message: 'Traduction supprimée avec succès' });
	} catch (error) {
		console.error('Erreur lors de la suppression de la traduction:', error);
		return json(
			{ error: publicErrorFromUnknown(error, 'Erreur lors de la suppression de la traduction') },
			{ status: 500 }
		);
	}
};
