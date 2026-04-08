import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		throw new Error('Non authentifié');
	}

	// Récupérer le filtre de statut depuis l'URL
	const statusFilter = url.searchParams.get('status') || 'pending';

	try {
		// Construire la condition de filtre
		let whereCondition;
		if (statusFilter === 'all') {
			whereCondition = eq(table.submission.userId, locals.user.id); // Pas de filtre de statut, toutes les soumissions de l'utilisateur
		} else {
			whereCondition = and(
				eq(table.submission.userId, locals.user.id),
				eq(table.submission.status, statusFilter as 'pending' | 'opened' | 'accepted' | 'rejected')
			);
		}

		// Charger les soumissions de l'utilisateur connecté avec le filtre
		const submissions = await db
			.select({
				id: table.submission.id,
				status: table.submission.status,
				type: table.submission.type,
				adminNotes: table.submission.adminNotes,
				data: table.submission.data,
				gameId: table.submission.gameId,
				translationId: table.submission.translationId,
				createdAt: table.submission.createdAt,
				updatedAt: table.submission.updatedAt,
				game: {
					id: table.game.id,
					name: table.game.name,
					image: table.game.image
				},
				translation: {
					id: table.gameTranslation.id,
					version: table.gameTranslation.version,
					tversion: table.gameTranslation.tversion,
					translationName: table.gameTranslation.translationName
				}
			})
			.from(table.submission)
			.leftJoin(table.game, eq(table.submission.gameId, table.game.id))
			.leftJoin(table.gameTranslation, eq(table.submission.translationId, table.gameTranslation.id))
			.where(whereCondition)
			.orderBy(
				statusFilter === 'pending'
					? asc(table.submission.createdAt)
					: desc(table.submission.createdAt)
			);

		// Parser les données et récupérer les jeux/traductions actuels pour les modifications
		const submissionsWithData = await Promise.all(
			submissions.map(async (sub) => {
				let parsedData = null;
				let currentGame = null;
				let currentTranslation = null;

				if (sub.data) {
					try {
						parsedData = JSON.parse(sub.data);
					} catch (e) {
						console.error('Erreur lors du parsing des données de soumission:', e);
					}
				}

				// Pour les soumissions acceptées, charger les données actuelles depuis la base de données
				// Pour les modifications de jeu, récupérer le jeu actuel
				if (sub.gameId) {
					const currentGameResult = await db
						.select()
						.from(table.game)
						.where(eq(table.game.id, sub.gameId))
						.limit(1);

					if (currentGameResult.length > 0) {
						currentGame = currentGameResult[0];
					}
				}

				// Pour les modifications de traduction, récupérer la traduction actuelle
				if (sub.translationId) {
					const currentTranslationResult = await db
						.select()
						.from(table.gameTranslation)
						.where(eq(table.gameTranslation.id, sub.translationId))
						.limit(1);

					if (currentTranslationResult.length > 0) {
						currentTranslation = currentTranslationResult[0];
					}
				}

				return {
					...sub,
					parsedData,
					currentGame,
					currentTranslation
				};
			})
		);

		// Compter les soumissions par statut pour l'utilisateur
		const pendingCountResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(
				and(eq(table.submission.userId, locals.user.id), eq(table.submission.status, 'pending'))
			);

		const openedCountResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(
				and(eq(table.submission.userId, locals.user.id), eq(table.submission.status, 'opened'))
			);

		const acceptedCountResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(
				and(eq(table.submission.userId, locals.user.id), eq(table.submission.status, 'accepted'))
			);

		const rejectedCountResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(
				and(eq(table.submission.userId, locals.user.id), eq(table.submission.status, 'rejected'))
			);

		const pendingCount = pendingCountResult[0]?.count || 0;
		const openedCount = openedCountResult[0]?.count || 0;
		const acceptedCount = acceptedCountResult[0]?.count || 0;
		const rejectedCount = rejectedCountResult[0]?.count || 0;

		// Charger tous les traducteurs pour pouvoir afficher leurs noms
		const translators = await db
			.select({
				id: table.translator.id,
				name: table.translator.name,
				userId: table.translator.userId
			})
			.from(table.translator);

		return {
			submissions: submissionsWithData,
			statusFilter,
			pendingCount,
			openedCount,
			acceptedCount,
			rejectedCount,
			translators
		};
	} catch (error: unknown) {
		// Si la table n'existe pas encore, retourner une liste vide
		console.warn("Table submission n'existe pas encore:", error);
		return {
			submissions: [],
			statusFilter,
			pendingCount: 0,
			openedCount: 0,
			acceptedCount: 0,
			rejectedCount: 0,
			translators: []
		};
	}
};

export const actions: Actions = {
	cancelSubmission: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Non authentifié' });

		const formData = await request.formData();
		const submissionId = formData.get('submissionId');
		if (typeof submissionId !== 'string' || !submissionId.trim()) {
			return fail(400, { message: 'ID de soumission requis' });
		}

		const [sub] = await db
			.select({
				id: table.submission.id,
				userId: table.submission.userId,
				status: table.submission.status
			})
			.from(table.submission)
			.where(eq(table.submission.id, submissionId))
			.limit(1);

		if (!sub) return fail(404, { message: 'Soumission non trouvée' });
		if (sub.userId !== locals.user.id) return fail(403, { message: 'Accès non autorisé' });
		if (sub.status !== 'pending') {
			return fail(400, { message: "Seules les soumissions en attente peuvent être annulées" });
		}

		await db
			.update(table.submission)
			.set({
				status: 'rejected',
				adminNotes: 'Annulée par l’utilisateur',
				updatedAt: new Date()
			})
			.where(eq(table.submission.id, submissionId));

		return { success: true };
	},
	updateSubmissionData: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Non authentifié' });

		const formData = await request.formData();
		const submissionId = formData.get('submissionId');
		const submissionDataJson = formData.get('submissionDataJson');

		if (typeof submissionId !== 'string' || !submissionId.trim()) {
			return fail(400, { message: 'ID de soumission requis' });
		}
		if (typeof submissionDataJson !== 'string' || !submissionDataJson.trim()) {
			return fail(400, { message: 'Données de soumission requises' });
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(submissionDataJson);
		} catch {
			return fail(400, { message: 'JSON invalide' });
		}
		if (!parsed || typeof parsed !== 'object') {
			return fail(400, { message: 'JSON invalide (objet attendu)' });
		}

		const [sub] = await db
			.select({
				id: table.submission.id,
				status: table.submission.status,
				adminNotes: table.submission.adminNotes,
				userId: table.submission.userId,
				type: table.submission.type
			})
			.from(table.submission)
			.where(eq(table.submission.id, submissionId))
			.limit(1);

		if (!sub) return fail(404, { message: 'Soumission non trouvée' });
		if (sub.userId !== locals.user.id) return fail(403, { message: 'Accès non autorisé' });

		// Règle: tant que la soumission n'a pas été "ouverte" (proxy adminNotes non vide) et
		// qu'elle reste en attente, on autorise la modification.
		if (sub.status !== 'pending') return fail(403, { message: 'Soumission déjà traitée par admin' });
		if (sub.adminNotes && sub.adminNotes.trim().length > 0) {
			return fail(403, { message: 'Soumission déjà ouverte par admin' });
		}

		// Validation minimale de la structure
		const obj = parsed as Record<string, unknown>;
		if (sub.type === 'translation') {
			if (!('translation' in obj) || obj.translation === null) {
				return fail(400, { message: 'Données invalides: clé `translation` manquante' });
			}
		} else {
			// type: game | update
			if (!('game' in obj) || obj.game === null) {
				return fail(400, { message: 'Données invalides: clé `game` manquante' });
			}
		}

		await db
			.update(table.submission)
			.set({
				data: JSON.stringify(parsed),
				updatedAt: new Date()
			})
			.where(eq(table.submission.id, submissionId));

		return { success: true };
	}
};
