import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

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
				eq(table.submission.status, statusFilter as 'pending' | 'accepted' | 'rejected')
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
			.orderBy(table.submission.createdAt);

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

				// Pour les modifications de jeu, récupérer le jeu actuel
				if (sub.type === 'update' && sub.gameId && !sub.translationId) {
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
				if (sub.type === 'translation' && sub.translationId) {
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
		const acceptedCount = acceptedCountResult[0]?.count || 0;
		const rejectedCount = rejectedCountResult[0]?.count || 0;

		return {
			submissions: submissionsWithData,
			statusFilter,
			pendingCount,
			acceptedCount,
			rejectedCount
		};
	} catch (error: unknown) {
		// Si la table n'existe pas encore, retourner une liste vide
		console.warn("Table submission n'existe pas encore:", error);
		return {
			submissions: [],
			statusFilter,
			pendingCount: 0,
			acceptedCount: 0,
			rejectedCount: 0
		};
	}
};
