import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

const cache = new Map<string, { value: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

export function invalidateLinkedTranslatorCache(userId?: string): void {
	if (userId) {
		cache.delete(userId);
		return;
	}
	cache.clear();
}

/** Indique si l'utilisateur a un profil traducteur lié (cache court, par userId). */
export async function userHasLinkedTranslator(userId: string): Promise<boolean> {
	const cached = cache.get(userId);
	if (cached && Date.now() <= cached.expiresAt) {
		return cached.value;
	}

	try {
		const [linkedTranslator] = await db
			.select({ id: table.translator.id })
			.from(table.translator)
			.where(eq(table.translator.userId, userId))
			.limit(1);

		const value = Boolean(linkedTranslator);
		cache.set(userId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
		return value;
	} catch (error) {
		console.warn('Erreur lors du chargement du traducteur lié:', error);
		return false;
	}
}
