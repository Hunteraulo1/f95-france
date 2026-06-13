import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { hasPermission } from '$lib/server/permissions';
import { and, eq, sql } from 'drizzle-orm';

type CacheKey = 'global' | `user:${string}`;

const cache = new Map<CacheKey, { count: number; expiresAt: number }>();
const CACHE_TTL_MS = 15_000;

export function invalidatePendingSubmissionsCountCache(): void {
	cache.clear();
}

export async function getPendingSubmissionsCountForUser(locals: App.Locals): Promise<number> {
	if (!locals.user) return 0;

	if (hasPermission(locals, 'submissions.review')) {
		return getGlobalPendingCount();
	}
	if (hasPermission(locals, 'submissions.own')) {
		return getUserPendingCount(locals.user.id);
	}
	return 0;
}

async function getGlobalPendingCount(): Promise<number> {
	const key: CacheKey = 'global';
	const cached = cache.get(key);
	if (cached && Date.now() <= cached.expiresAt) {
		return cached.count;
	}

	try {
		const result = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(eq(table.submission.status, 'pending'));

		const count = result[0]?.count || 0;
		cache.set(key, { count, expiresAt: Date.now() + CACHE_TTL_MS });
		return count;
	} catch (error) {
		console.warn('Erreur lors du chargement des soumissions en attente:', error);
		return 0;
	}
}

async function getUserPendingCount(userId: string): Promise<number> {
	const key: CacheKey = `user:${userId}`;
	const cached = cache.get(key);
	if (cached && Date.now() <= cached.expiresAt) {
		return cached.count;
	}

	try {
		const result = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(and(eq(table.submission.userId, userId), eq(table.submission.status, 'pending')));

		const count = result[0]?.count || 0;
		cache.set(key, { count, expiresAt: Date.now() + CACHE_TTL_MS });
		return count;
	} catch (error) {
		console.warn('Erreur lors du chargement des soumissions en attente:', error);
		return 0;
	}
}
