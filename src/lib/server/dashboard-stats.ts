import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { countSubmissionStatuses } from '$lib/server/submission-pages';
import { eq, sql } from 'drizzle-orm';

const toCount = (value: unknown): number => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

export async function countUserSubmissionStats(userId: string) {
	const [totalRow, byStatus] = await Promise.all([
		db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(eq(table.submission.userId, userId)),
		countSubmissionStatuses({ userId })
	]);

	return {
		totalSubmissions: toCount(totalRow[0]?.count),
		pendingSubmissions: byStatus.pendingCount,
		openedSubmissions: byStatus.openedCount,
		toFixSubmissions: byStatus.toFixCount,
		acceptedSubmissions: byStatus.acceptedCount,
		rejectedSubmissions: byStatus.rejectedCount
	};
}

export async function countGlobalSubmissionStats() {
	const counts = await countSubmissionStatuses();
	return {
		pending: counts.pendingCount,
		opened: counts.openedCount,
		toFix: counts.toFixCount,
		accepted: counts.acceptedCount,
		rejected: counts.rejectedCount,
		total:
			counts.pendingCount +
			counts.openedCount +
			counts.toFixCount +
			counts.acceptedCount +
			counts.rejectedCount
	};
}

export async function countTranslationStatsByStatus() {
	const [row] = await db
		.select({
			inProgress:
				sql<number>`sum(case when ${table.gameTranslation.status} = 'in_progress' then 1 else 0 end)`.as(
					'in_progress'
				),
			completed:
				sql<number>`sum(case when ${table.gameTranslation.status} = 'completed' then 1 else 0 end)`.as(
					'completed'
				),
			abandoned:
				sql<number>`sum(case when ${table.gameTranslation.status} = 'abandoned' then 1 else 0 end)`.as(
					'abandoned'
				),
			total: sql<number>`count(*)`.as('total')
		})
		.from(table.gameTranslation);

	return {
		inProgress: toCount(row?.inProgress),
		completed: toCount(row?.completed),
		abandoned: toCount(row?.abandoned),
		total: toCount(row?.total)
	};
}

export async function countRecentWithinDays(
	tableName: 'game' | 'gameTranslation' | 'user',
	days = 7
) {
	const column =
		tableName === 'game'
			? table.game.createdAt
			: tableName === 'gameTranslation'
				? table.gameTranslation.updatedAt
				: table.user.createdAt;
	const fromTable =
		tableName === 'game'
			? table.game
			: tableName === 'gameTranslation'
				? table.gameTranslation
				: table.user;

	const [row] = await db
		.select({ count: sql<number>`count(*)`.as('count') })
		.from(fromTable)
		.where(sql`${column} >= DATE_SUB(NOW(), INTERVAL ${days} DAY)`);

	return toCount(row?.count);
}
