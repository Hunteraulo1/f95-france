import { isTranslationOutdated } from '$lib/server/api/translation-public';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { userHasPermission } from '$lib/server/permissions';
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

	const isAdmin = await userHasPermission(locals.user, 'submissions.review');

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

		const userOpenedSubmissionsResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(
				and(eq(table.submission.userId, locals.user.id), eq(table.submission.status, 'opened'))
			);

		const userToFixSubmissionsResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(
				and(eq(table.submission.userId, locals.user.id), eq(table.submission.status, 'to_fix'))
			);

		const userAcceptedSubmissionsResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(
				and(eq(table.submission.userId, locals.user.id), eq(table.submission.status, 'accepted'))
			);
		const [userCounters] = await db
			.select({
				gameAdd: table.user.gameAdd,
				gameEdit: table.user.gameEdit
			})
			.from(table.user)
			.where(eq(table.user.id, locals.user.id))
			.limit(1);

		const [linkedTranslator] = await db
			.select({ id: table.translator.id })
			.from(table.translator)
			.where(eq(table.translator.userId, locals.user.id))
			.limit(1);

		let translationStats = {
			upToDate: 0,
			outdated: 0,
			total: 0
		};

		if (linkedTranslator) {
			const myTranslations = await db
				.select({
					version: table.gameTranslation.version,
					tversion: table.gameTranslation.tversion,
					tname: table.gameTranslation.tname,
					gameVersion: table.game.gameVersion
				})
				.from(table.gameTranslation)
				.innerJoin(table.game, eq(table.game.id, table.gameTranslation.gameId))
				.where(
					sql`${table.gameTranslation.translatorId} = ${linkedTranslator.id}
						 OR ${table.gameTranslation.proofreaderId} = ${linkedTranslator.id}`
				);

			let outdated = 0;
			for (const tr of myTranslations) {
				if (
					isTranslationOutdated(
						{
							version: tr.version,
							tversion: tr.tversion,
							tname: tr.tname
						},
						tr.gameVersion
					)
				) {
					outdated += 1;
				}
			}

			translationStats = {
				total: myTranslations.length,
				outdated,
				upToDate: Math.max(0, myTranslations.length - outdated)
			};
		}

		userStats = {
			totalSubmissions: toCount(userSubmissionsResult[0]?.count),
			pendingSubmissions: toCount(userPendingSubmissionsResult[0]?.count),
			openedSubmissions: toCount(userOpenedSubmissionsResult[0]?.count),
			toFixSubmissions: toCount(userToFixSubmissionsResult[0]?.count),
			acceptedSubmissions: toCount(userAcceptedSubmissionsResult[0]?.count),
			gameAdd: toCount(userCounters?.gameAdd),
			gameEdit: toCount(userCounters?.gameEdit),
			translations: translationStats
		};
	} catch (error: unknown) {
		console.warn('Erreur lors du chargement des statistiques utilisateur:', error);
		userStats = {
			totalSubmissions: 0,
			pendingSubmissions: 0,
			openedSubmissions: 0,
			toFixSubmissions: 0,
			acceptedSubmissions: 0,
			gameAdd: 0,
			gameEdit: 0,
			translations: {
				upToDate: 0,
				outdated: 0,
				total: 0
			}
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

			const submissionsOpenedResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.submission)
				.where(eq(table.submission.status, 'opened'));

			const submissionsToFixResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.submission)
				.where(eq(table.submission.status, 'to_fix'));

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
			const submissionsOpened = toCount(submissionsOpenedResult[0]?.count);
			const submissionsToFix = toCount(submissionsToFixResult[0]?.count);

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
					opened: submissionsOpened,
					toFix: submissionsToFix,
					accepted: submissionsAccepted,
					rejected: submissionsRejected,
					total:
						submissionsPending +
						submissionsAccepted +
						submissionsRejected +
						submissionsOpened +
						submissionsToFix
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
					opened: 0,
					toFix: 0,
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
