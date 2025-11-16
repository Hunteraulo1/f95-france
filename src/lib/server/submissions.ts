import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

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
	},
	translationData?: {
		translationName: string;
		version: string;
		tversion: string;
		status: string;
		ttype: string;
		tlink: string | null;
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
		type: string;
		website: string;
		threadId: number | null;
		tags: string | null;
		link: string | null;
		image: string;
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
		version: string;
		tversion: string;
		status: string;
		ttype: string;
		tlink: string;
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
		version: string;
		tversion: string;
		status: string;
		ttype: string;
		tlink: string;
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
export async function createGameDeleteSubmission(userId: string, gameId: string) {
	const submissionData = {
		gameId
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
	translationId: string
) {
	const submissionData = {
		gameId,
		translationId
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
		};
		translation?: {
			translationName?: string | null;
			version: string;
			tversion: string;
			status: string;
			ttype: string;
			tlink: string | null;
		};
		gameId?: string;
		translationId?: string;
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

		// Créer le jeu
		await db.insert(table.game).values({
			name: gameData.name,
			description: gameData.description || null,
			type: gameData.type as
				| 'renpy'
				| 'rpgm'
				| 'unity'
				| 'unreal'
				| 'flash'
				| 'html'
				| 'qsp'
				| 'other',
			website: gameData.website as 'f95z' | 'lc' | 'other',
			threadId: gameData.threadId
				? typeof gameData.threadId === 'string'
					? parseInt(gameData.threadId)
					: gameData.threadId
				: null,
			tags: gameData.tags || '',
			link: gameData.link || '',
			image: gameData.image,
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
			await db.insert(table.gameTranslation).values({
				gameId: gameId!,
				translationName: translationData.translationName || null,
				version: translationData.version,
				tversion: translationData.tversion,
				status: translationData.status as 'in_progress' | 'completed' | 'abandoned',
				ttype: translationData.ttype as 'auto' | 'vf' | 'manual' | 'semi-auto' | 'to_tested' | 'hs',
				tlink: translationData.tlink || '',
				translatorId: sub.userId,
				createdAt: new Date(),
				updatedAt: new Date()
			});
		}

		// Mettre à jour la soumission avec le gameId
		if (gameId) {
			await db
				.update(table.submission)
				.set({ gameId })
				.where(eq(table.submission.id, submissionId));
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

		// Sauvegarder les anciennes valeurs dans les données de la soumission
		const updatedData = {
			...parsedData,
			originalGame: {
				name: originalGame.name,
				description: originalGame.description,
				type: originalGame.type,
				website: originalGame.website,
				threadId: originalGame.threadId,
				tags: originalGame.tags,
				link: originalGame.link,
				image: originalGame.image
			}
		};

		// Mettre à jour les données de la soumission avec les anciennes valeurs
		await db
			.update(table.submission)
			.set({
				data: JSON.stringify(updatedData)
			})
			.where(eq(table.submission.id, submissionId));

		// Mettre à jour le jeu
		await db
			.update(table.game)
			.set({
				name: gameData.name,
				description: gameData.description || null,
				type: gameData.type as
					| 'renpy'
					| 'rpgm'
					| 'unity'
					| 'unreal'
					| 'flash'
					| 'html'
					| 'qsp'
					| 'other',
				website: gameData.website as 'f95z' | 'lc' | 'other',
				threadId: gameData.threadId
					? typeof gameData.threadId === 'string'
						? parseInt(gameData.threadId)
						: gameData.threadId
					: null,
				tags: gameData.tags || '',
				link: gameData.link || '',
				image: gameData.image,
				updatedAt: new Date()
			})
			.where(eq(table.game.id, sub.gameId));
	} else if (sub.type === 'translation') {
		// Créer ou mettre à jour une traduction
		if (!sub.gameId) {
			throw new Error('ID de jeu manquant pour la traduction');
		}

		const translationData = parsedData.translation;
		if (!translationData) {
			throw new Error('Données de traduction manquantes');
		}

		if (sub.translationId) {
			// Mettre à jour une traduction existante
			// Récupérer la traduction actuelle pour sauvegarder les anciennes valeurs
			const existingTranslation = await db
				.select()
				.from(table.gameTranslation)
				.where(eq(table.gameTranslation.id, sub.translationId))
				.limit(1);

			if (existingTranslation.length === 0) {
				throw new Error('Traduction non trouvée');
			}

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
					tlink: originalTranslation.tlink
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
			await db
				.update(table.gameTranslation)
				.set({
					translationName: translationData.translationName || null,
					version: translationData.version,
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
					updatedAt: new Date()
				})
				.where(eq(table.gameTranslation.id, sub.translationId));
		} else {
			// Créer une nouvelle traduction
			await db.insert(table.gameTranslation).values({
				gameId: sub.gameId,
				translationName: translationData.translationName || null,
				version: translationData.version,
				tversion: translationData.tversion,
				status: translationData.status as 'in_progress' | 'completed' | 'abandoned',
				ttype: translationData.ttype as 'auto' | 'vf' | 'manual' | 'semi-auto' | 'to_tested' | 'hs',
				tlink: translationData.tlink || '',
				translatorId: sub.userId,
				createdAt: new Date(),
				updatedAt: new Date()
			});

			// Récupérer l'ID de la traduction créée
			const createdTranslation = await db
				.select({ id: table.gameTranslation.id })
				.from(table.gameTranslation)
				.where(
					and(
						eq(table.gameTranslation.gameId, sub.gameId),
						eq(table.gameTranslation.version, translationData.version),
						eq(table.gameTranslation.tversion, translationData.tversion)
					)
				)
				.limit(1);

			const translationId = createdTranslation[0]?.id;

			// Mettre à jour la soumission avec le translationId
			if (translationId) {
				await db
					.update(table.submission)
					.set({ translationId })
					.where(eq(table.submission.id, submissionId));
			}
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
					translatorId: originalTranslation.translatorId,
					proofreaderId: originalTranslation.proofreaderId,
					ac: originalTranslation.ac
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
					type: originalGame.type,
					website: originalGame.website,
					threadId: originalGame.threadId,
					tags: originalGame.tags,
					link: originalGame.link,
					image: originalGame.image
				},
				originalTranslations: existingTranslations.map((t) => ({
					translationName: t.translationName,
					version: t.version,
					tversion: t.tversion,
					status: t.status,
					ttype: t.ttype,
					tlink: t.tlink,
					translatorId: t.translatorId,
					proofreaderId: t.proofreaderId,
					ac: t.ac
				}))
			};

			// Mettre à jour les données de la soumission avec les données originales
			await db
				.update(table.submission)
				.set({
					data: JSON.stringify(updatedData)
				})
				.where(eq(table.submission.id, submissionId));

			// Supprimer d'abord toutes les traductions associées
			await db.delete(table.gameTranslation).where(eq(table.gameTranslation.gameId, sub.gameId));

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
			version: string;
			tversion: string;
			status: string;
			ttype: string;
			tlink: string | null;
		};
		originalGame?: {
			name: string;
			description?: string | null;
			type: string;
			website: string;
			threadId?: number | null;
			tags?: string | null;
			link?: string | null;
			image: string;
		};
		originalTranslation?: {
			translationName?: string | null;
			version: string;
			tversion: string;
			status: string;
			ttype: string;
			tlink: string;
			translatorId?: string | null;
			proofreaderId?: string | null;
			ac?: boolean | null;
		};
		originalTranslations?: Array<{
			translationName?: string | null;
			version: string;
			tversion: string;
			status: string;
			ttype: string;
			tlink: string;
			translatorId?: string | null;
			proofreaderId?: string | null;
			ac?: boolean | null;
		}>;
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
				type: originalGame.type as
					| 'renpy'
					| 'rpgm'
					| 'unity'
					| 'unreal'
					| 'flash'
					| 'html'
					| 'qsp'
					| 'other',
				website: originalGame.website as 'f95z' | 'lc' | 'other',
				threadId: originalGame.threadId
					? typeof originalGame.threadId === 'string'
						? parseInt(originalGame.threadId)
						: originalGame.threadId
					: null,
				tags: originalGame.tags || '',
				link: originalGame.link || '',
				image: originalGame.image,
				updatedAt: new Date()
			})
			.where(eq(table.game.id, sub.gameId));
	} else if (sub.type === 'translation') {
		if (sub.translationId) {
			// Restaurer les anciennes valeurs de la traduction
			if (!parsedData.originalTranslation) {
				throw new Error(
					"Données originales de la traduction non trouvées. Impossible d'annuler les changements."
				);
			}

			const originalTranslation = parsedData.originalTranslation;

			// Restaurer la traduction avec les anciennes valeurs
			await db
				.update(table.gameTranslation)
				.set({
					translationName: originalTranslation.translationName || null,
					version: originalTranslation.version,
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
					updatedAt: new Date()
				})
				.where(eq(table.gameTranslation.id, sub.translationId));
		} else {
			// Supprimer la traduction créée
			if (!sub.gameId) {
				throw new Error("ID de jeu manquant pour l'annulation");
			}

			// Récupérer la traduction créée pour cette soumission
			const translationData = parsedData.translation;
			if (!translationData) {
				throw new Error('Données de traduction manquantes');
			}

			// Trouver et supprimer la traduction créée
			const createdTranslation = await db
				.select({ id: table.gameTranslation.id })
				.from(table.gameTranslation)
				.where(
					and(
						eq(table.gameTranslation.gameId, sub.gameId),
						eq(table.gameTranslation.version, translationData.version),
						eq(table.gameTranslation.tversion, translationData.tversion)
					)
				)
				.limit(1);

			if (createdTranslation.length > 0) {
				await db
					.delete(table.gameTranslation)
					.where(eq(table.gameTranslation.id, createdTranslation[0].id));
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
				version: originalTranslation.version,
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
				type: originalGame.type as
					| 'renpy'
					| 'rpgm'
					| 'unity'
					| 'unreal'
					| 'flash'
					| 'html'
					| 'qsp'
					| 'other',
				website: originalGame.website as 'f95z' | 'lc' | 'other',
				threadId: originalGame.threadId
					? typeof originalGame.threadId === 'string'
						? parseInt(originalGame.threadId)
						: originalGame.threadId
					: null,
				tags: originalGame.tags || '',
				link: originalGame.link || '',
				image: originalGame.image,
				createdAt: new Date(),
				updatedAt: new Date()
			});

			// Restaurer les traductions si elles existent
			if (parsedData.originalTranslations && parsedData.originalTranslations.length > 0) {
				for (const originalTranslation of parsedData.originalTranslations) {
					await db.insert(table.gameTranslation).values({
						gameId: sub.gameId!,
						translationName: originalTranslation.translationName || null,
						version: originalTranslation.version,
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
