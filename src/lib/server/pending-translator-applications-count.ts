import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { hasPermission } from '$lib/server/permissions';
import { eq, sql } from 'drizzle-orm';

const cache = new Map<'global', { count: number; expiresAt: number }>();
const CACHE_TTL_MS = 15_000;

export function invalidatePendingTranslatorApplicationsCountCache(): void {
	cache.clear();
}

export async function getPendingTranslatorApplicationsCountForUser(
	locals: App.Locals
): Promise<number> {
	if (!locals.user) return 0;
	if (!hasPermission(locals, 'translator_applications.review')) return 0;

	const key = 'global' as const;
	const cached = cache.get(key);
	if (cached && Date.now() <= cached.expiresAt) {
		return cached.count;
	}

	try {
		const result = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.translatorApplication)
			.where(eq(table.translatorApplication.status, 'pending'));

		const count = result[0]?.count || 0;
		cache.set(key, { count, expiresAt: Date.now() + CACHE_TTL_MS });
		return count;
	} catch (error) {
		console.warn('Erreur lors du chargement des candidatures traducteur en attente:', error);
		return 0;
	}
}
