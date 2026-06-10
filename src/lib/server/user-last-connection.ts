import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';

export async function fetchLastApiActivityByUserIds(userIds: string[]): Promise<Map<string, Date>> {
	if (userIds.length === 0) return new Map();

	const rows = await db
		.select({
			userId: table.apiLog.userId,
			lastAt: sql<Date>`max(${table.apiLog.createdAt})`
		})
		.from(table.apiLog)
		.where(inArray(table.apiLog.userId, userIds))
		.groupBy(table.apiLog.userId);

	const map = new Map<string, Date>();
	for (const row of rows) {
		if (row.userId) map.set(row.userId, row.lastAt);
	}
	return map;
}

export function resolveLastConnectionAt(
	lastSeenAt: Date | null | undefined,
	lastApiActivity: Date | null | undefined
): Date | null {
	if (!lastSeenAt && !lastApiActivity) return null;
	if (!lastSeenAt) return lastApiActivity ?? null;
	if (!lastApiActivity) return lastSeenAt;
	return lastSeenAt > lastApiActivity ? lastSeenAt : lastApiActivity;
}

export function touchUserLastSeen(userId: string): void {
	db.update(table.user)
		.set({ lastSeenAt: new Date() })
		.where(eq(table.user.id, userId))
		.catch((error) => {
			console.error('Échec mise à jour lastSeenAt:', error);
		});
}
