import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

const toCount = (value: unknown): number => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return {
			stats: null,
			userStats: null,
			isAdmin: false
		};
	}

	const isAdmin = locals.user.role === 'admin' || locals.user.role === 'superadmin';

	// Statistiques générales (pour tous les utilisateurs)
	let userStats;
	try {
		// Statistiques personnelles de l'utilisateur
		const userSubmissionsResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(eq(table.submission.userId, locals.user.id));

		const userPendingSubmissionsResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(
				and(eq(table.submission.userId, locals.user.id), eq(table.submission.status, 'pending'))
			);

		const userAcceptedSubmissionsResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(
				and(eq(table.submission.userId, locals.user.id), eq(table.submission.status, 'accepted'))
			);

		userStats = {
			totalSubmissions: toCount(userSubmissionsResult[0]?.count),
			pendingSubmissions: toCount(userPendingSubmissionsResult[0]?.count),
			acceptedSubmissions: toCount(userAcceptedSubmissionsResult[0]?.count),
			gameAdd: locals.user.gameAdd || 0,
			gameEdit: locals.user.gameEdit || 0
		};
	} catch (error: unknown) {
		console.warn('Erreur lors du chargement des statistiques utilisateur:', error);
		userStats = {
			totalSubmissions: 0,
			pendingSubmissions: 0,
			acceptedSubmissions: 0,
			gameAdd: locals.user.gameAdd || 0,
			gameEdit: locals.user.gameEdit || 0
		};
	}

	// Statistiques administrateur
	let stats = null;
	if (isAdmin) {
		try {
			// Nombre total de jeux
			const totalGamesResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.game);

			// Nombre de traductions par statut
			const translationsInProgressResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.gameTranslation)
				.where(eq(table.gameTranslation.status, 'in_progress'));

			const translationsCompletedResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.gameTranslation)
				.where(eq(table.gameTranslation.status, 'completed'));

			const translationsAbandonedResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.gameTranslation)
				.where(eq(table.gameTranslation.status, 'abandoned'));

			const translationsUniqueTotalResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.gameTranslation);

			// Nombre de soumissions par statut
			const submissionsPendingResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.submission)
				.where(eq(table.submission.status, 'pending'));

			const submissionsAcceptedResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.submission)
				.where(eq(table.submission.status, 'accepted'));

			const submissionsRejectedResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.submission)
				.where(eq(table.submission.status, 'rejected'));

			// Nombre total d'utilisateurs
			const totalUsersResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.user);

			// Nombre de traducteurs
			const totalTranslatorsResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.translator);

			// Jeux récemment ajoutés (7 derniers jours)
			const recentGamesResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.game)
				.where(sql`${table.game.createdAt} >= NOW() - INTERVAL '7 days'`);

			// Traductions récemment mises à jour (7 derniers jours)
			const recentTranslationsResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.gameTranslation)
				.where(sql`${table.gameTranslation.updatedAt} >= NOW() - INTERVAL '7 days'`);

			// Utilisateurs récemment inscrits (7 derniers jours)
			const recentUsersResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.user)
				.where(sql`${table.user.createdAt} >= NOW() - INTERVAL '7 days'`);

			const translationsInProgress = toCount(translationsInProgressResult[0]?.count);
			const translationsCompleted = toCount(translationsCompletedResult[0]?.count);
			const translationsAbandoned = toCount(translationsAbandonedResult[0]?.count);
			const translationsUniqueTotal = toCount(translationsUniqueTotalResult[0]?.count);
			const submissionsPending = toCount(submissionsPendingResult[0]?.count);
			const submissionsAccepted = toCount(submissionsAcceptedResult[0]?.count);
			const submissionsRejected = toCount(submissionsRejectedResult[0]?.count);

			stats = {
				totalGames: toCount(totalGamesResult[0]?.count),
				translations: {
					inProgress: translationsInProgress,
					completed: translationsCompleted,
					abandoned: translationsAbandoned,
					total: translationsUniqueTotal
				},
				submissions: {
					pending: submissionsPending,
					accepted: submissionsAccepted,
					rejected: submissionsRejected,
					total: submissionsPending + submissionsAccepted + submissionsRejected
				},
				totalUsers: toCount(totalUsersResult[0]?.count),
				totalTranslators: toCount(totalTranslatorsResult[0]?.count),
				recent: {
					games: toCount(recentGamesResult[0]?.count),
					translations: toCount(recentTranslationsResult[0]?.count),
					users: toCount(recentUsersResult[0]?.count)
				}
			};
		} catch (error: unknown) {
			console.warn('Erreur lors du chargement des statistiques admin:', error);
			stats = {
				totalGames: 0,
				translations: {
					inProgress: 0,
					completed: 0,
					abandoned: 0,
					total: 0
				},
				submissions: {
					pending: 0,
					accepted: 0,
					rejected: 0,
					total: 0
				},
				totalUsers: 0,
				totalTranslators: 0,
				recent: {
					games: 0,
					translations: 0,
					users: 0
				}
			};
		}
	}

	return {
		stats,
		userStats,
		isAdmin
	};
};
