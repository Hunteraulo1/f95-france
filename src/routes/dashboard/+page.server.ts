import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

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
	let userStats = null;
	try {
		// Statistiques personnelles de l'utilisateur
		const userSubmissionsResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(eq(table.submission.userId, locals.user.id));

		const userPendingSubmissionsResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(and(
				eq(table.submission.userId, locals.user.id),
				eq(table.submission.status, 'pending')
			));

		const userAcceptedSubmissionsResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(and(
				eq(table.submission.userId, locals.user.id),
				eq(table.submission.status, 'accepted')
			));

		userStats = {
			totalSubmissions: userSubmissionsResult[0]?.count || 0,
			pendingSubmissions: userPendingSubmissionsResult[0]?.count || 0,
			acceptedSubmissions: userAcceptedSubmissionsResult[0]?.count || 0,
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
				.where(sql`${table.game.createdAt} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`);

			// Traductions récemment mises à jour (7 derniers jours)
			const recentTranslationsResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.gameTranslation)
				.where(sql`${table.gameTranslation.updatedAt} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`);

			// Utilisateurs récemment inscrits (7 derniers jours)
			const recentUsersResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.user)
				.where(sql`${table.user.createdAt} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`);

			stats = {
				totalGames: totalGamesResult[0]?.count || 0,
				translations: {
					inProgress: translationsInProgressResult[0]?.count || 0,
					completed: translationsCompletedResult[0]?.count || 0,
					abandoned: translationsAbandonedResult[0]?.count || 0,
					total: (translationsInProgressResult[0]?.count || 0) + 
						   (translationsCompletedResult[0]?.count || 0) + 
						   (translationsAbandonedResult[0]?.count || 0)
				},
				submissions: {
					pending: submissionsPendingResult[0]?.count || 0,
					accepted: submissionsAcceptedResult[0]?.count || 0,
					rejected: submissionsRejectedResult[0]?.count || 0,
					total: (submissionsPendingResult[0]?.count || 0) + 
						   (submissionsAcceptedResult[0]?.count || 0) + 
						   (submissionsRejectedResult[0]?.count || 0)
				},
				totalUsers: totalUsersResult[0]?.count || 0,
				totalTranslators: totalTranslatorsResult[0]?.count || 0,
				recent: {
					games: recentGamesResult[0]?.count || 0,
					translations: recentTranslationsResult[0]?.count || 0,
					users: recentUsersResult[0]?.count || 0
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
