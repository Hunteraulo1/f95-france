import { getUserById } from '$lib/server/auth';
import { sendDiscordWebhookUpdatesSubmissionApplied } from '$lib/server/discord-webhook';
import {
	syncTranslationToGoogleSheet,
	syncTranslatorToGoogleSheet
} from '$lib/server/google-sheets-sync';
import { createGameUpdateRow } from '$lib/server/game-updates';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { createTranslationSubmission } from '$lib/server/submissions';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const normVersion = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

// POST - Créer une nouvelle traduction
export const POST: RequestHandler = async ({ params, request, locals }) => {
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
			translationName,
			version,
			tversion,
			status,
			ttype,
			tlink,
			tname,
			directMode,
			translatorId,
			proofreaderId
		} = body;

		// Validation des données requises
		// Le lien n'est pas requis pour les traductions intégrées ou "pas de traduction"
		const linkNotRequired = tname === 'integrated' || tname === 'no_translation';
		if (!tversion || !status || !ttype || (!linkNotRequired && !tlink)) {
			return json(
				{
					error: linkNotRequired
						? 'Les champs Version de traduction, Statut et Type sont requis'
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

		const acValue =
			game[0].gameAutoCheck === true &&
			normVersion(tversion).length > 0 &&
			normVersion(tversion) === normVersion(game[0].gameVersion);

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
			await createTranslationSubmission(currentUser.id, gameId, {
				translationName: translationName || null,
				version: typeof version === 'string' ? version.trim() || null : null,
				tversion,
				status,
				ttype,
				tlink,
				translatorId: translatorId || null,
				proofreaderId: proofreaderId || null,
				ac: acValue
			});
			// La table update/MAJ doit refléter l'action dès l'ajout.
			await createGameUpdateRow(gameId, 'adding');

			return json(
				{
					message: 'Soumission créée avec succès. Elle sera examinée par un administrateur.',
					submission: true
				},
				{ status: 201 }
			);
		}

		// Mode direct pour les admins ou superadmins en mode direct
		// Créer la nouvelle traduction
		// Pour les traductions intégrées ou "pas de traduction", le lien doit être une chaîne vide
		// (le champ est NOT NULL dans le schéma, donc on utilise '' au lieu de null)
		const tlinkStored = linkNotRequired || tlink === null ? '' : tlink || '';
		const [created] = await db
			.insert(table.gameTranslation)
			.values({
				gameId,
				translationName,
				version: typeof version === 'string' ? version.trim() || null : null,
				tversion,
				status,
				ttype,
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
				translationName: translationName || null,
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
		void sendDiscordWebhookUpdatesSubmissionApplied({
			submissionId: created?.id ?? 'direct-translation',
			submissionType: 'translation',
			dataJson,
			translationWasUpdate: false,
			adminNotes: null
		});
		if (created?.id) {
			void syncTranslationToGoogleSheet(created.id).catch((err) => {
				console.warn('[google-sheets-sync] add translation failed:', err);
			});
		}
		if (translatorId) {
			void syncTranslatorToGoogleSheet(String(translatorId)).catch((err) => {
				console.warn('[google-sheets-sync] add translator failed:', err);
			});
		}
		if (proofreaderId) {
			void syncTranslatorToGoogleSheet(String(proofreaderId)).catch((err) => {
				console.warn('[google-sheets-sync] add proofreader failed:', err);
			});
		}
		await createGameUpdateRow(gameId, 'adding');

		return json({ message: 'Traduction créée avec succès' }, { status: 201 });
	} catch (error) {
		console.error('Erreur lors de la création de la traduction:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
