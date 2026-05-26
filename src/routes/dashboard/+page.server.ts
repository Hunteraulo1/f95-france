import { isTranslationOutdated } from '$lib/server/api/translation-public';
import {
	countGlobalSubmissionStats,
	countRecentWithinDays,
	countTranslationStatsByStatus,
	countUserSubmissionStats
} from '$lib/server/dashboard-stats';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { hasPermission } from '$lib/server/permissions';
import { eq, sql } from 'drizzle-orm';
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

	const isAdmin = hasPermission(locals, 'submissions.review');

	// Statistiques générales (pour tous les utilisateurs)
	let userStats;
	try {
		const submissionStats = await countUserSubmissionStats(locals.user.id);
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
			...submissionStats,
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

			const [translationStats, submissionStats, recentGames, recentTranslations, recentUsers] =
				await Promise.all([
					countTranslationStatsByStatus(),
					countGlobalSubmissionStats(),
					countRecentWithinDays('game'),
					countRecentWithinDays('gameTranslation'),
					countRecentWithinDays('user')
				]);

			// Nombre total d'utilisateurs
			const totalUsersResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.user);

			// Nombre de traducteurs
			const totalTranslatorsResult = await db
				.select({ count: sql<number>`count(*)`.as('count') })
				.from(table.translator);

			stats = {
				totalGames: toCount(totalGamesResult[0]?.count),
				translations: translationStats,
				submissions: submissionStats,
				totalUsers: toCount(totalUsersResult[0]?.count),
				totalTranslators: toCount(totalTranslatorsResult[0]?.count),
				recent: {
					games: recentGames,
					translations: recentTranslations,
					users: recentUsers
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
