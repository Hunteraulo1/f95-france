import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	clampTranslationAc,
	clearAllTranslationAutoCheckForGame,
	getGameAllowsTranslationAutoCheck,
	resolveGameAutoCheckForWebsite
} from '$lib/server/game-auto-check';
import {
	deleteGameTranslationsFromGoogleSheet,
	deleteTranslationFromGoogleSheet,
	syncGameTranslationsToGoogleSheet,
	syncTranslationToGoogleSheet,
	syncTranslatorToGoogleSheet
} from '$lib/server/google-sheets-sync';
import { createGameUpdateRow, touchGameUpdatedToday } from '$lib/server/game-updates';
import { coerceGameEngineType, defaultGameTypeForGame } from '$lib/server/game-engine-type';
import { and, desc, eq, inArray, or } from 'drizzle-orm';

/**
 * Crée une soumission pour un nouveau jeu
 */
export async function createGameSubmission(
	userId: string,
	gameData: {
		name: string;
		description: string | null;
		type: string;
		website: string;
		threadId: number | null;
		tags: string | null;
		link: string | null;
		image: string;
		gameAutoCheck?: boolean;
		gameVersion?: string | null;
	},
	translationData?: {
		translationName: string;
		version?: string | null;
		tversion: string;
		status: string;
		ttype: string;
		tlink: string | null;
		translatorId?: string | null;
		proofreaderId?: string | null;
		ac?: boolean | null;
	}
) {
	const submissionData = {
		game: gameData,
		translation: translationData || null
	};

	const submission = await db.insert(table.submission).values({
		userId,
		type: 'game',
		data: JSON.stringify(submissionData),
		status: 'pending'
	});

	return submission;
}

/**
 * Crée une soumission pour une modification de jeu
 */
export async function createGameUpdateSubmission(
	userId: string,
	gameId: string,
	gameData: {
		name: string;
		description: string | null;
		/** Si présent, appliqué à toutes les traductions à l’acceptation de la soumission. */
		type?: string;
		website: string;
		threadId: number | null;
		tags: string | null;
		link: string | null;
		image: string;
		gameAutoCheck?: boolean;
		gameVersion?: string | null;
	}
) {
	const submissionData = {
		gameId,
		game: gameData
	};

	const submission = await db.insert(table.submission).values({
		userId,
		gameId,
		type: 'update',
		data: JSON.stringify(submissionData),
		status: 'pending'
	});

	return submission;
}

/**
 * Crée une soumission pour une nouvelle traduction
 */
export async function createTranslationSubmission(
	userId: string,
	gameId: string,
	translationData: {
		translationName: string | null;
		version?: string | null;
		tversion: string;
		status: string;
		ttype: string;
		tlink: string;
		gameType?: string;
		translatorId?: string | null;
		proofreaderId?: string | null;
		ac?: boolean | null;
	}
) {
	const submissionData = {
		gameId,
		translation: translationData
	};

	const submission = await db.insert(table.submission).values({
		userId,
		gameId,
		type: 'translation',
		data: JSON.stringify(submissionData),
		status: 'pending'
	});

	return submission;
}

/**
 * Crée une soumission pour une modification de traduction
 */
export async function createTranslationUpdateSubmission(
	userId: string,
	gameId: string,
	translationId: string,
	translationData: {
		translationName: string | null;
		version?: string | null;
		tversion: string;
		status: string;
		ttype: string;
		tlink: string;
		tname?: string | null;
		gameType?: string;
		translatorId?: string | null;
		proofreaderId?: string | null;
		ac?: boolean | null;
	}
) {
	const submissionData = {
		gameId,
		translationId,
		translation: translationData
	};

	const submission = await db.insert(table.submission).values({
		userId,
		gameId,
		translationId,
		type: 'translation',
		data: JSON.stringify(submissionData),
		status: 'pending'
	});

	return submission;
}

/**
 * Crée une soumission pour une suppression de jeu
 */
export async function createGameDeleteSubmission(userId: string, gameId: string, reason: string) {
	const r = reason.trim();
	if (!r) {
		throw new Error('La raison de la suppression est obligatoire');
	}
	const submissionData = {
		gameId,
		reason: r
	};

	const submission = await db.insert(table.submission).values({
		userId,
		gameId,
		type: 'delete',
		data: JSON.stringify(submissionData),
		status: 'pending'
	});

	return submission;
}

/**
 * Crée une soumission pour une suppression de traduction
 */
export async function createTranslationDeleteSubmission(
	userId: string,
	gameId: string,
	translationId: string,
	reason: string
) {
	const r = reason.trim();
	if (!r) {
		throw new Error('La raison de la suppression est obligatoire');
	}
	const submissionData = {
		gameId,
		translationId,
		reason: r
	};

	const submission = await db.insert(table.submission).values({
		userId,
		gameId,
		translationId,
		type: 'delete',
		data: JSON.stringify(submissionData),
		status: 'pending'
	});

	return submission;
}

/**
 * Applique les changements d'une soumission acceptée
 */
export async function applySubmission(submissionId: string) {
	// Récupérer la soumission
	const submission = await db
		.select()
		.from(table.submission)
		.where(eq(table.submission.id, submissionId))
		.limit(1);

	if (submission.length === 0) {
		throw new Error('Soumission non trouvée');
	}

	const sub = submission[0];

	// Parser les données JSON
	let parsedData: {
		game?: {
			name: string;
			description?: string | null;
			type: string;
			website: string;
			threadId?: number | string | null;
			tags?: string | null;
			link?: string | null;
			image: string;
			gameAutoCheck?: boolean;
			/** Présent sur les soumissions récentes ; anciennes soumissions peuvent l’omettre */
			gameVersion?: string | null;
		};
		translation?: {
			translationName?: string | null;
			version?: string | null;
			tversion: string;
			status: string;
			ttype: string;
			tlink: string | null;
			tname?: string | null;
			gameType?: string;
			translatorId?: string | null;
			proofreaderId?: string | null;
			ac?: boolean | null;
		};
		gameId?: string;
		translationId?: string;
		/** Snapshot pour annuler une mise à jour jeu (type moteur par traduction). */
		originalTranslationGameTypes?: Array<{ id: string; gameType: string }>;
	};
	try {
		parsedData = JSON.parse(sub.data);
	} catch {
		throw new Error('Erreur lors du parsing des données de soumission');
	}

	// Appliquer les changements selon le type
	if (sub.type === 'game') {
		// Créer un nouveau jeu
		const gameData = parsedData.game;
		if (!gameData) {
			throw new Error('Données de jeu manquantes');
		}

		// Vérifier si un jeu avec le même nom existe déjà
		const existingGame = await db
			.select({ id: table.game.id })
			.from(table.game)
			.where(eq(table.game.name, gameData.name))
			.limit(1);

		if (existingGame.length > 0) {
			throw new Error('Un jeu avec ce nom existe déjà');
		}

		const engineFromGamePayload = coerceGameEngineType(gameData.type);

		// Créer le jeu
		await db.insert(table.game).values({
			name: gameData.name,
			description: gameData.description || null,
			website: gameData.website as 'f95z' | 'lc' | 'other',
			threadId: gameData.threadId
				? typeof gameData.threadId === 'string'
					? parseInt(gameData.threadId)
					: gameData.threadId
				: null,
			tags: gameData.tags || '',
			link: gameData.link || '',
			image: gameData.image,
			gameAutoCheck: resolveGameAutoCheckForWebsite(
				String(gameData.website),
				gameData.gameAutoCheck,
				true
			),
			gameVersion:
				gameData.gameVersion !== undefined &&
				gameData.gameVersion !== null &&
				String(gameData.gameVersion).trim()
					? String(gameData.gameVersion).trim()
					: null,
			createdAt: new Date(),
			updatedAt: new Date()
		});

		// Récupérer l'ID du jeu créé
		const createdGame = await db
			.select({ id: table.game.id })
			.from(table.game)
			.where(eq(table.game.name, gameData.name))
			.limit(1);

		const gameId = createdGame[0]?.id;

		// Créer la traduction si elle est fournie
		if (parsedData.translation && parsedData.translation.translationName) {
			const translationData = parsedData.translation;
			const engineNewTr =
				translationData.gameType !== undefined &&
				translationData.gameType !== null &&
				String(translationData.gameType).trim() !== ''
					? coerceGameEngineType(translationData.gameType)
					: engineFromGamePayload;
			const allowsNewGameAc = await getGameAllowsTranslationAutoCheck(gameId!);
			const [createdTranslation] = await db
				.insert(table.gameTranslation)
				.values({
					gameId: gameId!,
					translationName: translationData.translationName || null,
					version:
						typeof translationData.version === 'string'
							? translationData.version.trim() || null
							: null,
					tversion: translationData.tversion,
					status: translationData.status as 'in_progress' | 'completed' | 'abandoned',
					ttype: translationData.ttype as
						| 'auto'
						| 'vf'
						| 'manual'
						| 'semi-auto'
						| 'to_tested'
						| 'hs',
					gameType: engineNewTr,
					tlink: translationData.tlink || '',
					translatorId: translationData.translatorId ?? null,
					proofreaderId: translationData.proofreaderId ?? null,
					ac: clampTranslationAc(allowsNewGameAc, translationData.ac ?? false),
					createdAt: new Date(),
					updatedAt: new Date()
				})
				.returning({ id: table.gameTranslation.id });

			if (createdTranslation?.id) {
				void syncTranslationToGoogleSheet(createdTranslation.id).catch((err) => {
					console.warn('[google-sheets-sync] submission game translation failed:', err);
				});
			}
			if (translationData.translatorId) {
				void syncTranslatorToGoogleSheet(translationData.translatorId).catch((err) => {
					console.warn('[google-sheets-sync] submission game translator failed:', err);
				});
			}
			if (translationData.proofreaderId) {
				void syncTranslatorToGoogleSheet(translationData.proofreaderId).catch((err) => {
					console.warn('[google-sheets-sync] submission game proofreader failed:', err);
				});
			}
		}

		// Mettre à jour la soumission avec le gameId
		if (gameId) {
			await db
				.update(table.submission)
				.set({ gameId })
				.where(eq(table.submission.id, submissionId));
			await createGameUpdateRow(gameId, 'adding');
		}
	} else if (sub.type === 'update') {
		// Mettre à jour un jeu existant
		if (!sub.gameId) {
			throw new Error('ID de jeu manquant pour la mise à jour');
		}

		const gameData = parsedData.game;
		if (!gameData) {
			throw new Error('Données de jeu manquantes');
		}

		// Récupérer le jeu actuel pour sauvegarder les anciennes valeurs
		const existingGame = await db
			.select()
			.from(table.game)
			.where(eq(table.game.id, sub.gameId))
			.limit(1);

		if (existingGame.length === 0) {
			throw new Error('Jeu non trouvé');
		}

		const originalGame = existingGame[0];

		const nextGameAutoCheck = resolveGameAutoCheckForWebsite(
			String(gameData.website),
			gameData.gameAutoCheck,
			originalGame.gameAutoCheck ?? true
		);

		const prevTranslationTypes = await db
			.select({
				id: table.gameTranslation.id,
				gameType: table.gameTranslation.gameType
			})
			.from(table.gameTranslation)
			.where(eq(table.gameTranslation.gameId, sub.gameId));

		// Sauvegarder les anciennes valeurs dans les données de la soumission
		const updatedData = {
			...parsedData,
			originalGame: {
				name: originalGame.name,
				description: originalGame.description,
				website: originalGame.website,
				threadId: originalGame.threadId,
				tags: originalGame.tags,
				link: originalGame.link,
				image: originalGame.image,
				gameAutoCheck: originalGame.gameAutoCheck ?? true,
				gameVersion: originalGame.gameVersion ?? null
			},
			originalTranslationGameTypes: prevTranslationTypes
		};

		// Mettre à jour les données de la soumission avec les anciennes valeurs
		await db
			.update(table.submission)
			.set({
				data: JSON.stringify(updatedData)
			})
			.where(eq(table.submission.id, submissionId));

		const nextGameVersion =
			gameData.gameVersion !== undefined
				? gameData.gameVersion && String(gameData.gameVersion).trim()
					? String(gameData.gameVersion).trim()
					: null
				: (originalGame.gameVersion ?? null);

		// Mettre à jour le jeu
		await db
			.update(table.game)
			.set({
				name: gameData.name,
				description: gameData.description || null,
				website: gameData.website as 'f95z' | 'lc' | 'other',
				threadId: gameData.threadId
					? typeof gameData.threadId === 'string'
						? parseInt(gameData.threadId)
						: gameData.threadId
					: null,
				tags: gameData.tags || '',
				link: gameData.link || '',
				image: gameData.image,
				gameAutoCheck: nextGameAutoCheck,
				gameVersion: nextGameVersion,
				updatedAt: new Date()
			})
			.where(eq(table.game.id, sub.gameId));

		if (
			gameData.type !== undefined &&
			gameData.type !== null &&
			String(gameData.type).trim() !== ''
		) {
			const nextEngine = coerceGameEngineType(gameData.type);
			await db
				.update(table.gameTranslation)
				.set({ gameType: nextEngine, updatedAt: new Date() })
				.where(eq(table.gameTranslation.gameId, sub.gameId));
		}

		if (!nextGameAutoCheck) {
			await clearAllTranslationAutoCheckForGame(sub.gameId);
		}
		void syncGameTranslationsToGoogleSheet(sub.gameId).catch((err) => {
			console.warn('[google-sheets-sync] submission game update rows failed:', err);
		});
		await touchGameUpdatedToday(sub.gameId);
	} else if (sub.type === 'translation') {
		// Créer ou mettre à jour une traduction
		if (!sub.gameId) {
			throw new Error('ID de jeu manquant pour la traduction');
		}

		const translationData = parsedData.translation;
		if (!translationData) {
			throw new Error('Données de traduction manquantes');
		}

		const allowsAc = await getGameAllowsTranslationAutoCheck(sub.gameId);
		let syncedTranslationId: string | null = null;

		if (sub.translationId) {
			// Vérifier si la traduction existe toujours (elle peut avoir été supprimée lors d'un revert)
			const existingTranslation = await db
				.select()
				.from(table.gameTranslation)
				.where(eq(table.gameTranslation.id, sub.translationId))
				.limit(1);

			if (existingTranslation.length > 0) {
				// Mettre à jour une traduction existante
				const originalTranslation = existingTranslation[0];

				// Sauvegarder les anciennes valeurs dans les données de la soumission
				const updatedData = {
					...parsedData,
					originalTranslation: {
						translationName: originalTranslation.translationName,
						version: originalTranslation.version,
						tversion: originalTranslation.tversion,
						status: originalTranslation.status,
						ttype: originalTranslation.ttype,
						tlink: originalTranslation.tlink,
						tname: originalTranslation.tname,
						translatorId: originalTranslation.translatorId,
						proofreaderId: originalTranslation.proofreaderId,
						ac: originalTranslation.ac,
						gameType: originalTranslation.gameType
					}
				};

				// Mettre à jour les données de la soumission avec les anciennes valeurs
				await db
					.update(table.submission)
					.set({
						data: JSON.stringify(updatedData)
					})
					.where(eq(table.submission.id, submissionId));

				// Mettre à jour la traduction
				const nextTname =
					translationData.tname != null && String(translationData.tname).length > 0
						? (translationData.tname as (typeof originalTranslation)['tname'])
						: originalTranslation.tname;

				const trSet: {
					translationName: string | null;
					version: string | null;
					tversion: string;
					status: 'in_progress' | 'completed' | 'abandoned';
					ttype: 'auto' | 'vf' | 'manual' | 'semi-auto' | 'to_tested' | 'hs';
					tlink: string;
					tname: (typeof originalTranslation)['tname'];
					translatorId: string | null;
					proofreaderId: string | null;
					ac: boolean;
					updatedAt: Date;
					gameType?: (typeof table.gameTranslation.$inferSelect)['gameType'];
				} = {
					translationName: translationData.translationName || null,
					version:
						typeof translationData.version === 'string'
							? translationData.version.trim() || null
							: null,
					tversion: translationData.tversion,
					status: translationData.status as 'in_progress' | 'completed' | 'abandoned',
					ttype: translationData.ttype as
						| 'auto'
						| 'vf'
						| 'manual'
						| 'semi-auto'
						| 'to_tested'
						| 'hs',
					tlink: translationData.tlink || '',
					tname: nextTname,
					translatorId: translationData.translatorId ?? originalTranslation.translatorId ?? null,
					proofreaderId: translationData.proofreaderId ?? originalTranslation.proofreaderId ?? null,
					ac: clampTranslationAc(allowsAc, translationData.ac ?? originalTranslation.ac ?? false),
					updatedAt: new Date()
				};
				if (
					translationData.gameType !== undefined &&
					translationData.gameType !== null &&
					String(translationData.gameType).trim() !== ''
				) {
					trSet.gameType = coerceGameEngineType(translationData.gameType);
				}
				await db
					.update(table.gameTranslation)
					.set(trSet)
					.where(eq(table.gameTranslation.id, sub.translationId));
				syncedTranslationId = sub.translationId;
			} else {
				// La traduction a été supprimée (probablement lors d'un revert), créer une nouvelle traduction
				const insertTname =
					translationData.tname != null && String(translationData.tname).length > 0
						? translationData.tname
						: 'translation';
				const fallbackEngine = await defaultGameTypeForGame(sub.gameId);
				const engineRecreated =
					translationData.gameType !== undefined &&
					translationData.gameType !== null &&
					String(translationData.gameType).trim() !== ''
						? coerceGameEngineType(translationData.gameType)
						: fallbackEngine;
				const [recreated] = await db
					.insert(table.gameTranslation)
					.values({
						gameId: sub.gameId,
						translationName: translationData.translationName || null,
						version:
							typeof translationData.version === 'string'
								? translationData.version.trim() || null
								: null,
						tversion: translationData.tversion,
						status: translationData.status as 'in_progress' | 'completed' | 'abandoned',
						ttype: translationData.ttype as
							| 'auto'
							| 'vf'
							| 'manual'
							| 'semi-auto'
							| 'to_tested'
							| 'hs',
						gameType: engineRecreated,
						tlink: translationData.tlink || '',
						tname: insertTname as typeof table.gameTranslation.$inferInsert.tname,
						translatorId: translationData.translatorId ?? null,
						proofreaderId: translationData.proofreaderId ?? null,
						ac: clampTranslationAc(allowsAc, translationData.ac ?? false),
						createdAt: new Date(),
						updatedAt: new Date()
					})
					.returning({ id: table.gameTranslation.id });

				const translationId = recreated?.id;

				// Mettre à jour la soumission avec le nouveau translationId
				if (translationId) {
					await db
						.update(table.submission)
						.set({ translationId })
						.where(eq(table.submission.id, submissionId));
					syncedTranslationId = translationId;
				}
			}
		} else {
			// Créer une nouvelle traduction
			const insertTnameNew =
				translationData.tname != null && String(translationData.tname).length > 0
					? translationData.tname
					: 'translation';
			const engineNewTr = await defaultGameTypeForGame(sub.gameId);
			const engineCreated =
				translationData.gameType !== undefined &&
				translationData.gameType !== null &&
				String(translationData.gameType).trim() !== ''
					? coerceGameEngineType(translationData.gameType)
					: engineNewTr;
			const [createdRow] = await db
				.insert(table.gameTranslation)
				.values({
					gameId: sub.gameId,
					translationName: translationData.translationName || null,
					version:
						typeof translationData.version === 'string'
							? translationData.version.trim() || null
							: null,
					tversion: translationData.tversion,
					status: translationData.status as 'in_progress' | 'completed' | 'abandoned',
					ttype: translationData.ttype as
						| 'auto'
						| 'vf'
						| 'manual'
						| 'semi-auto'
						| 'to_tested'
						| 'hs',
					gameType: engineCreated,
					tlink: translationData.tlink || '',
					tname: insertTnameNew as typeof table.gameTranslation.$inferInsert.tname,
					translatorId: translationData.translatorId ?? null,
					proofreaderId: translationData.proofreaderId ?? null,
					ac: clampTranslationAc(allowsAc, translationData.ac ?? false),
					createdAt: new Date(),
					updatedAt: new Date()
				})
				.returning({ id: table.gameTranslation.id });

			const translationId = createdRow?.id;

			// Mettre à jour la soumission avec le translationId
			if (translationId) {
				await db
					.update(table.submission)
					.set({ translationId })
					.where(eq(table.submission.id, submissionId));
				syncedTranslationId = translationId;
			}
		}
		if (syncedTranslationId) {
			void syncTranslationToGoogleSheet(syncedTranslationId).catch((err) => {
				console.warn('[google-sheets-sync] submission apply failed:', err);
			});
			void (async () => {
				try {
					const [synced] = await db
						.select({
							translatorId: table.gameTranslation.translatorId,
							proofreaderId: table.gameTranslation.proofreaderId
						})
						.from(table.gameTranslation)
						.where(eq(table.gameTranslation.id, syncedTranslationId))
						.limit(1);
					if (synced?.translatorId) {
						void syncTranslatorToGoogleSheet(synced.translatorId).catch((err) => {
							console.warn('[google-sheets-sync] submission translator failed:', err);
						});
					}
					if (synced?.proofreaderId) {
						void syncTranslatorToGoogleSheet(synced.proofreaderId).catch((err) => {
							console.warn('[google-sheets-sync] submission proofreader failed:', err);
						});
					}
				} catch (err) {
					console.warn('[google-sheets-sync] submission translator lookup failed:', err);
				}
			})();
		}
		if (sub.translationId) {
			// Soumission de modification de traduction.
			await touchGameUpdatedToday(sub.gameId);
		} else {
			// Soumission d'ajout de traduction.
			await createGameUpdateRow(sub.gameId, 'adding');
		}
	} else if (sub.type === 'delete') {
		// Supprimer un jeu ou une traduction
		if (sub.translationId) {
			// Supprimer une traduction
			if (!sub.gameId) {
				throw new Error('ID de jeu manquant pour la suppression de traduction');
			}

			// Récupérer la traduction complète pour sauvegarder les données
			const existingTranslation = await db
				.select()
				.from(table.gameTranslation)
				.where(
					and(
						eq(table.gameTranslation.id, sub.translationId),
						eq(table.gameTranslation.gameId, sub.gameId)
					)
				)
				.limit(1);

			if (existingTranslation.length === 0) {
				throw new Error('Traduction non trouvée');
			}

			const originalTranslation = existingTranslation[0];

			// Sauvegarder les données originales dans la soumission
			const updatedData = {
				...parsedData,
				originalTranslation: {
					translationName: originalTranslation.translationName,
					version: originalTranslation.version,
					tversion: originalTranslation.tversion,
					status: originalTranslation.status,
					ttype: originalTranslation.ttype,
					tlink: originalTranslation.tlink,
					tname: originalTranslation.tname,
					translatorId: originalTranslation.translatorId,
					proofreaderId: originalTranslation.proofreaderId,
					ac: originalTranslation.ac,
					gameType: originalTranslation.gameType
				}
			};

			// Mettre à jour les données de la soumission avec les données originales
			await db
				.update(table.submission)
				.set({
					data: JSON.stringify(updatedData)
				})
				.where(eq(table.submission.id, submissionId));

			// Supprimer la traduction
			await db.delete(table.gameTranslation).where(eq(table.gameTranslation.id, sub.translationId));
			void deleteTranslationFromGoogleSheet(sub.translationId).catch((err) => {
				console.warn('[google-sheets-sync] submission delete translation row failed:', err);
			});
		} else if (sub.gameId) {
			// Supprimer un jeu
			// Récupérer le jeu complet pour sauvegarder les données
			const existingGame = await db
				.select()
				.from(table.game)
				.where(eq(table.game.id, sub.gameId))
				.limit(1);

			if (existingGame.length === 0) {
				throw new Error('Jeu non trouvé');
			}

			const originalGame = existingGame[0];

			// Récupérer toutes les traductions associées pour sauvegarder leurs données
			const existingTranslations = await db
				.select()
				.from(table.gameTranslation)
				.where(eq(table.gameTranslation.gameId, sub.gameId));

			// Sauvegarder les données originales dans la soumission
			const updatedData = {
				...parsedData,
				originalGame: {
					name: originalGame.name,
					description: originalGame.description,
					website: originalGame.website,
					threadId: originalGame.threadId,
					tags: originalGame.tags,
					link: originalGame.link,
					image: originalGame.image,
					gameAutoCheck: originalGame.gameAutoCheck ?? true,
					gameVersion: originalGame.gameVersion ?? null
				},
				originalTranslations: existingTranslations.map((t) => ({
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
			};

			// Mettre à jour les données de la soumission avec les données originales
			await db
				.update(table.submission)
				.set({
					data: JSON.stringify(updatedData)
				})
				.where(eq(table.submission.id, submissionId));

			const translationIds = existingTranslations.map((t) => t.id);
			const rejectionNote = 'Rejet automatique: jeu supprimé via application de soumission.';

			// Détacher les FK de submission avant suppression physique du jeu/traductions
			// (évite la contrainte submission_game_id_game_id_fk).
			if (translationIds.length > 0) {
				await db
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
								eq(table.submission.gameId, sub.gameId),
								inArray(table.submission.translationId, translationIds)
							)
						)
					);

				await db
					.update(table.submission)
					.set({ translationId: null, updatedAt: new Date() })
					.where(inArray(table.submission.translationId, translationIds));
			} else {
				await db
					.update(table.submission)
					.set({
						status: 'rejected',
						adminNotes: rejectionNote,
						updatedAt: new Date()
					})
					.where(
						and(eq(table.submission.status, 'pending'), eq(table.submission.gameId, sub.gameId))
					);
			}

			await db
				.update(table.submission)
				.set({ gameId: null, updatedAt: new Date() })
				.where(eq(table.submission.gameId, sub.gameId));

			// Supprimer d'abord toutes les traductions associées
			await db.delete(table.gameTranslation).where(eq(table.gameTranslation.gameId, sub.gameId));
			void deleteGameTranslationsFromGoogleSheet(existingTranslations.map((t) => t.id)).catch(
				(err) => {
					console.warn('[google-sheets-sync] submission delete game rows failed:', err);
				}
			);

			// Supprimer d'abord les lignes de la table "update" (FK vers game)
			// avant la suppression du jeu.
			await db.delete(table.update).where(eq(table.update.gameId, sub.gameId));

			// Supprimer le jeu
			await db.delete(table.game).where(eq(table.game.id, sub.gameId));
		} else {
			throw new Error('ID de jeu ou de traduction manquant pour la suppression');
		}
	}
}

/**
 * Annule les changements d'une soumission acceptée (lorsqu'elle est refusée)
 */
export async function revertSubmission(submissionId: string) {
	// Récupérer la soumission
	const submission = await db
		.select()
		.from(table.submission)
		.where(eq(table.submission.id, submissionId))
		.limit(1);

	if (submission.length === 0) {
		throw new Error('Soumission non trouvée');
	}

	const sub = submission[0];

	// Parser les données JSON
	let parsedData: {
		game?: {
			name: string;
			description?: string | null;
			type: string;
			website: string;
			threadId?: number | string | null;
			tags?: string | null;
			link?: string | null;
			image: string;
		};
		translation?: {
			translationName?: string | null;
			version?: string | null;
			tversion: string;
			status: string;
			ttype: string;
			tlink: string | null;
			tname?: string | null;
			gameType?: string;
			translatorId?: string | null;
			proofreaderId?: string | null;
			ac?: boolean | null;
		};
		originalGame?: {
			name: string;
			description?: string | null;
			/** Anciennes soumissions (type sur le jeu) */
			type?: string;
			website: string;
			threadId?: number | null;
			tags?: string | null;
			link?: string | null;
			image: string;
			gameAutoCheck?: boolean;
			gameVersion?: string | null;
		};
		originalTranslation?: {
			translationName?: string | null;
			version?: string | null;
			tversion: string;
			status: string;
			ttype: string;
			tlink: string;
			tname?: string | null;
			translatorId?: string | null;
			proofreaderId?: string | null;
			ac?: boolean | null;
			gameType?: string;
		};
		originalTranslations?: Array<{
			translationName?: string | null;
			version?: string | null;
			tversion: string;
			status: string;
			ttype: string;
			tlink: string;
			tname?: string | null;
			translatorId?: string | null;
			proofreaderId?: string | null;
			ac?: boolean | null;
			gameType?: string;
		}>;
		originalTranslationGameTypes?: Array<{ id: string; gameType: string }>;
		gameId?: string;
		translationId?: string;
	};
	try {
		parsedData = JSON.parse(sub.data);
	} catch {
		throw new Error('Erreur lors du parsing des données de soumission');
	}

	// Annuler les changements selon le type
	if (sub.type === 'game') {
		// Supprimer le jeu créé (et sa traduction si créée)
		if (!sub.gameId) {
			throw new Error("ID de jeu manquant pour l'annulation");
		}

		// Supprimer d'abord toutes les traductions associées
		await db.delete(table.gameTranslation).where(eq(table.gameTranslation.gameId, sub.gameId));

		// Supprimer d'abord les lignes de la table "update" (FK vers game)
		await db.delete(table.update).where(eq(table.update.gameId, sub.gameId));

		// Supprimer le jeu
		await db.delete(table.game).where(eq(table.game.id, sub.gameId));
	} else if (sub.type === 'update') {
		// Restaurer les anciennes valeurs du jeu
		if (!sub.gameId) {
			throw new Error("ID de jeu manquant pour l'annulation");
		}

		if (!parsedData.originalGame) {
			throw new Error(
				"Données originales du jeu non trouvées. Impossible d'annuler les changements."
			);
		}

		const originalGame = parsedData.originalGame;

		// Restaurer le jeu avec les anciennes valeurs
		await db
			.update(table.game)
			.set({
				name: originalGame.name,
				description: originalGame.description || null,
				website: originalGame.website as 'f95z' | 'lc' | 'other',
				threadId: originalGame.threadId
					? typeof originalGame.threadId === 'string'
						? parseInt(originalGame.threadId)
						: originalGame.threadId
					: null,
				tags: originalGame.tags || '',
				link: originalGame.link || '',
				image: originalGame.image,
				gameAutoCheck:
					'gameAutoCheck' in originalGame && typeof originalGame.gameAutoCheck === 'boolean'
						? originalGame.gameAutoCheck
						: true,
				gameVersion:
					'gameVersion' in originalGame ? (originalGame.gameVersion as string | null) : null,
				updatedAt: new Date()
			})
			.where(eq(table.game.id, sub.gameId));

		const snap = parsedData.originalTranslationGameTypes;
		if (snap && snap.length > 0) {
			for (const row of snap) {
				await db
					.update(table.gameTranslation)
					.set({
						gameType: coerceGameEngineType(row.gameType),
						updatedAt: new Date()
					})
					.where(eq(table.gameTranslation.id, row.id));
			}
		} else if (originalGame.type) {
			const legacy = coerceGameEngineType(originalGame.type);
			await db
				.update(table.gameTranslation)
				.set({ gameType: legacy, updatedAt: new Date() })
				.where(eq(table.gameTranslation.gameId, sub.gameId));
		}
	} else if (sub.type === 'translation') {
		if (sub.translationId && parsedData.originalTranslation) {
			// Restaurer les anciennes valeurs de la traduction (mise à jour)
			const originalTranslation = parsedData.originalTranslation;

			// Restaurer la traduction avec les anciennes valeurs
			const revertTrPatch: {
				translationName: string | null;
				version: string | null;
				tversion: string;
				status: 'in_progress' | 'completed' | 'abandoned';
				ttype: 'auto' | 'vf' | 'manual' | 'semi-auto' | 'to_tested' | 'hs';
				tlink: string;
				translatorId: string | null;
				proofreaderId: string | null;
				ac: boolean;
				updatedAt: Date;
				gameType?: (typeof table.gameTranslation.$inferSelect)['gameType'];
			} = {
				translationName: originalTranslation.translationName || null,
				version:
					typeof originalTranslation.version === 'string'
						? originalTranslation.version.trim() || null
						: null,
				tversion: originalTranslation.tversion,
				status: originalTranslation.status as 'in_progress' | 'completed' | 'abandoned',
				ttype: originalTranslation.ttype as
					| 'auto'
					| 'vf'
					| 'manual'
					| 'semi-auto'
					| 'to_tested'
					| 'hs',
				tlink: originalTranslation.tlink || '',
				translatorId: originalTranslation.translatorId || null,
				proofreaderId: originalTranslation.proofreaderId || null,
				ac: originalTranslation.ac ?? false,
				updatedAt: new Date()
			};
			if (
				originalTranslation.gameType !== undefined &&
				originalTranslation.gameType !== null &&
				String(originalTranslation.gameType).length > 0
			) {
				revertTrPatch.gameType = coerceGameEngineType(originalTranslation.gameType);
			}
			await db
				.update(table.gameTranslation)
				.set(revertTrPatch)
				.where(eq(table.gameTranslation.id, sub.translationId));
		} else {
			// Supprimer la traduction créée (nouvelle traduction ou traduction sans données originales)
			if (!sub.gameId) {
				throw new Error("ID de jeu manquant pour l'annulation");
			}

			// Si translationId existe, utiliser directement cet ID pour supprimer
			if (sub.translationId) {
				await db
					.delete(table.gameTranslation)
					.where(eq(table.gameTranslation.id, sub.translationId));
			} else {
				// Sinon, chercher la traduction par les données de la soumission
				const translationData = parsedData.translation;
				if (!translationData) {
					throw new Error('Données de traduction manquantes');
				}

				// Trouver et supprimer la traduction créée (la plus récente si ambiguïté)
				const createdTranslation = await db
					.select({ id: table.gameTranslation.id })
					.from(table.gameTranslation)
					.where(
						and(
							eq(table.gameTranslation.gameId, sub.gameId),
							eq(table.gameTranslation.tversion, translationData.tversion)
						)
					)
					.orderBy(desc(table.gameTranslation.createdAt))
					.limit(1);

				if (createdTranslation.length > 0) {
					await db
						.delete(table.gameTranslation)
						.where(eq(table.gameTranslation.id, createdTranslation[0].id));
				}
			}
		}
	} else if (sub.type === 'delete') {
		// Restaurer le jeu ou la traduction supprimé
		if (sub.translationId) {
			// Restaurer la traduction supprimée
			if (!sub.gameId) {
				throw new Error("ID de jeu manquant pour l'annulation");
			}

			if (!parsedData.originalTranslation) {
				throw new Error(
					"Données originales de la traduction non trouvées. Impossible d'annuler les changements."
				);
			}

			const originalTranslation = parsedData.originalTranslation;

			// Restaurer la traduction avec l'ancien ID si disponible
			await db.insert(table.gameTranslation).values({
				...(sub.translationId ? { id: sub.translationId } : {}),
				gameId: sub.gameId!,
				translationName: originalTranslation.translationName || null,
				version:
					typeof originalTranslation.version === 'string'
						? originalTranslation.version.trim() || null
						: null,
				tversion: originalTranslation.tversion,
				status: originalTranslation.status as 'in_progress' | 'completed' | 'abandoned',
				ttype: originalTranslation.ttype as
					| 'auto'
					| 'vf'
					| 'manual'
					| 'semi-auto'
					| 'to_tested'
					| 'hs',
				tlink: originalTranslation.tlink || '',
				tname:
					(originalTranslation.tname as typeof table.gameTranslation.$inferInsert.tname) ??
					'translation',
				translatorId: originalTranslation.translatorId || null,
				proofreaderId: originalTranslation.proofreaderId || null,
				ac: originalTranslation.ac ?? false,
				gameType:
					originalTranslation.gameType !== undefined &&
					originalTranslation.gameType !== null &&
					String(originalTranslation.gameType).length > 0
						? coerceGameEngineType(originalTranslation.gameType)
						: 'other',
				createdAt: new Date(),
				updatedAt: new Date()
			});
		} else if (sub.gameId) {
			// Restaurer le jeu supprimé et ses traductions
			if (!parsedData.originalGame) {
				throw new Error(
					"Données originales du jeu non trouvées. Impossible d'annuler les changements."
				);
			}

			const originalGame = parsedData.originalGame;

			// Restaurer le jeu
			await db.insert(table.game).values({
				id: sub.gameId,
				name: originalGame.name,
				description: originalGame.description || null,
				website: originalGame.website as 'f95z' | 'lc' | 'other',
				threadId: originalGame.threadId
					? typeof originalGame.threadId === 'string'
						? parseInt(originalGame.threadId)
						: originalGame.threadId
					: null,
				tags: originalGame.tags || '',
				link: originalGame.link || '',
				image: originalGame.image,
				gameAutoCheck: resolveGameAutoCheckForWebsite(
					String(originalGame.website),
					'gameAutoCheck' in originalGame && typeof originalGame.gameAutoCheck === 'boolean'
						? originalGame.gameAutoCheck
						: undefined,
					true
				),
				gameVersion:
					'gameVersion' in originalGame ? (originalGame.gameVersion as string | null) : null,
				createdAt: new Date(),
				updatedAt: new Date()
			});

			// Restaurer les traductions si elles existent
			if (parsedData.originalTranslations && parsedData.originalTranslations.length > 0) {
				for (const originalTranslation of parsedData.originalTranslations) {
					await db.insert(table.gameTranslation).values({
						gameId: sub.gameId!,
						translationName: originalTranslation.translationName || null,
						version:
							typeof originalTranslation.version === 'string'
								? originalTranslation.version.trim() || null
								: null,
						tversion: originalTranslation.tversion,
						status: originalTranslation.status as 'in_progress' | 'completed' | 'abandoned',
						ttype: originalTranslation.ttype as
							| 'auto'
							| 'vf'
							| 'manual'
							| 'semi-auto'
							| 'to_tested'
							| 'hs',
						tlink: originalTranslation.tlink || '',
						tname:
							(originalTranslation.tname as typeof table.gameTranslation.$inferInsert.tname) ??
							'translation',
						translatorId: originalTranslation.translatorId || null,
						proofreaderId: originalTranslation.proofreaderId || null,
						ac: originalTranslation.ac ?? false,
						gameType:
							originalTranslation.gameType !== undefined &&
							originalTranslation.gameType !== null &&
							String(originalTranslation.gameType).length > 0
								? coerceGameEngineType(originalTranslation.gameType)
								: 'other',
						createdAt: new Date(),
						updatedAt: new Date()
					});
				}
			}
		} else {
			throw new Error("ID de jeu ou de traduction manquant pour l'annulation");
		}
	}
}
