import { getUserById } from '$lib/server/auth';
import { sendDiscordWebhookUpdatesSubmissionApplied } from '$lib/server/discord-webhook';
import { clampTranslationAc, getGameAllowsTranslationAutoCheck } from '$lib/server/game-auto-check';
import {
	deleteTranslationFromGoogleSheet,
	syncTranslationToGoogleSheet,
	syncTranslatorToGoogleSheet
} from '$lib/server/google-sheets-sync';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	createTranslationDeleteSubmission,
	createTranslationUpdateSubmission
} from '$lib/server/submissions';
import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

// PUT - Modifier une traduction
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	const { id: gameId, translationId } = params;

	if (!gameId || !translationId) {
		return json({ error: 'ID du jeu et ID de traduction requis' }, { status: 400 });
	}

	try {
		const body = await request.json();
		const {
			translationName,
			tversion,
			status,
			ttype,
			tlink,
			tname: tnameBody,
			directMode,
			ac,
			translatorId,
			proofreaderId
		} = body;

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
		const tlinkStored = linkNotRequired ? '' : typeof tlink === 'string' ? tlink : '';
		if (!tversion || !status || !ttype || (!linkNotRequired && !tlinkStored.trim())) {
			return json(
				{
					error: linkNotRequired
						? 'Version de traduction, statut et type sont requis'
						: 'Tous les champs sont requis (y compris le lien de traduction)'
				},
				{ status: 400 }
			);
		}

		const allowsTranslationAc = await getGameAllowsTranslationAutoCheck(gameId);
		const acValue = clampTranslationAc(allowsTranslationAc, ac);

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
			await createTranslationUpdateSubmission(currentUser.id, gameId, translationId, {
				translationName: translationName || null,
				tversion,
				status,
				ttype,
				tlink: tlinkStored,
				tname: effectiveTname,
				translatorId: translatorId || null,
				proofreaderId: proofreaderId || null,
				ac: acValue
			});

			return json({
				message: 'Soumission créée avec succès. Elle sera examinée par un administrateur.',
				submission: true
			});
		}

		// Mode direct pour les admins ou superadmins en mode direct
		// Mettre à jour la traduction
		await db
			.update(table.gameTranslation)
			.set({
				translationName: translationName || null,
				tversion,
				status,
				ttype,
				tlink: tlinkStored,
				tname: effectiveTname,
				translatorId: translatorId || null,
				proofreaderId: proofreaderId || null,
				ac: acValue,
				updatedAt: new Date()
			})
			.where(eq(table.gameTranslation.id, translationId));

		const dataJson = JSON.stringify({
			gameId,
			translation: {
				translationName: translationName || null,
				tversion,
				status,
				ttype,
				tlink: tlinkStored,
				translatorId: translatorId || null,
				proofreaderId: proofreaderId || null,
				ac: acValue
			},
			originalTranslation: {
				translationName: before.translationName,
				tversion: before.tversion,
				status: before.status,
				ttype: before.ttype,
				tlink: before.tlink,
				translatorId: before.translatorId,
				proofreaderId: before.proofreaderId,
				ac: before.ac
			}
		});
		void sendDiscordWebhookUpdatesSubmissionApplied({
			submissionId: translationId,
			submissionType: 'translation',
			dataJson,
			translationWasUpdate: true,
			adminNotes: null
		});
		void syncTranslationToGoogleSheet(translationId).catch((err) => {
			console.warn('[google-sheets-sync] update translation failed:', err);
		});
		if (translatorId) {
			void syncTranslatorToGoogleSheet(String(translatorId)).catch((err) => {
				console.warn('[google-sheets-sync] update translator failed:', err);
			});
		}
		if (proofreaderId) {
			void syncTranslatorToGoogleSheet(String(proofreaderId)).catch((err) => {
				console.warn('[google-sheets-sync] update proofreader failed:', err);
			});
		}

		return json({ message: 'Traduction modifiée avec succès' });
	} catch (error) {
		console.error('Erreur lors de la modification de la traduction:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};

// DELETE - Supprimer une traduction
export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

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
			await createTranslationDeleteSubmission(currentUser.id, gameId, translationId, reason);

			return json({
				message:
					'Soumission de suppression créée avec succès. Elle sera examinée par un administrateur.',
				submission: true
			});
		}

		// Mode direct pour les admins ou superadmins en mode direct
		const dataJson = JSON.stringify({
			gameId,
			reason,
			originalTranslation: {
				translationName: tr.translationName,
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
		void deleteTranslationFromGoogleSheet(translationId).catch((err) => {
			console.warn('[google-sheets-sync] delete translation row failed:', err);
		});

		return json({ message: 'Traduction supprimée avec succès' });
	} catch (error) {
		console.error('Erreur lors de la suppression de la traduction:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
