import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

let cache: { value: boolean; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5_000;

export function invalidateMaintenanceModeCache(): void {
	cache = null;
}

/** Mode maintenance (cache court — hooks + layout dashboard). */
export async function getMaintenanceMode(): Promise<boolean> {
	if (cache && Date.now() <= cache.expiresAt) {
		return cache.value;
	}

	try {
		const [cfg] = await db
			.select({ maintenanceMode: table.config.maintenanceMode })
			.from(table.config)
			.where(eq(table.config.id, 'main'))
			.limit(1);
		const value = cfg?.maintenanceMode === true;
		cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
		return value;
	} catch {
		return false;
	}
}
