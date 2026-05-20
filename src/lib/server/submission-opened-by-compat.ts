import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

let cachedHasOpenedByUserIdColumn: boolean | undefined;

/** True si la migration 0016 (`opened_by_user_id`) est appliquée sur cette base. */
export async function hasSubmissionOpenedByUserIdColumn(): Promise<boolean> {
	if (cachedHasOpenedByUserIdColumn !== undefined) {
		return cachedHasOpenedByUserIdColumn;
	}
	try {
		const rows = await db
			.select({ one: sql<number>`1` })
			.from(sql`information_schema.columns`)
			.where(
				sql`table_schema = 'public' AND table_name = 'submission' AND column_name = 'opened_by_user_id'`
			)
			.limit(1);
		cachedHasOpenedByUserIdColumn = rows.length > 0;
	} catch {
		cachedHasOpenedByUserIdColumn = false;
	}
	return cachedHasOpenedByUserIdColumn;
}

/** Réinitialise le cache (tests / après migration à chaud). */
export function resetSubmissionOpenedByUserIdColumnCache(): void {
	cachedHasOpenedByUserIdColumn = undefined;
}

/** N’inclut `openedByUserId` dans un `.set()` que si la colonne existe en base. */
export async function submissionOpenedByUserIdPatch(
	openedByUserId: string | null
): Promise<{ openedByUserId?: string | null }> {
	if (!(await hasSubmissionOpenedByUserIdColumn())) {
		return {};
	}
	return { openedByUserId };
}
