import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

const cache = new Map<string, boolean>();

async function hasPublicColumn(tableName: string, columnName: string): Promise<boolean> {
	const key = `${tableName}.${columnName}`;
	const cached = cache.get(key);
	if (cached !== undefined) return cached;

	try {
		const rows = await db
			.select({ one: sql<number>`1` })
			.from(sql`information_schema.columns`)
			.where(
				sql`table_schema = DATABASE() AND table_name = ${tableName} AND column_name = ${columnName}`
			)
			.limit(1);
		const exists = rows.length > 0;
		cache.set(key, exists);
		return exists;
	} catch {
		cache.set(key, false);
		return false;
	}
}

export function resetSchemaColumnCompatCache(): void {
	cache.clear();
}

export async function hasGameTranslationGameTypeColumn(): Promise<boolean> {
	return hasPublicColumn('game_translation', 'game_type');
}

export async function hasGameAutoCheckColumn(): Promise<boolean> {
	return hasPublicColumn('game', 'game_auto_check');
}

export async function hasUpdateStatusColumn(): Promise<boolean> {
	return hasPublicColumn('update', 'status');
}

export async function hasUpdateHistoryTable(): Promise<boolean> {
	return hasPublicColumn('update_history', 'id');
}

export async function hasSubmissionReviewedByUserIdColumn(): Promise<boolean> {
	return hasPublicColumn('submission', 'reviewed_by_user_id');
}

/** N’inclut `reviewedByUserId` dans un `.set()` que si la colonne existe en base. */
export async function submissionReviewedByUserIdPatch(
	reviewedByUserId: string | null
): Promise<{ reviewedByUserId?: string | null }> {
	if (!(await hasSubmissionReviewedByUserIdColumn())) {
		return {};
	}
	return { reviewedByUserId };
}

/** Message DB exploitable côté client (sans fuite de détail interne). */
export function publicErrorFromUnknown(error: unknown, fallback: string): string {
	if (!error || typeof error !== 'object') return fallback;
	const code = 'code' in error ? String((error as { code?: string }).code) : '';
	if (code === '42703') {
		return 'Base de données à jour requise (migration manquante). Contactez un administrateur.';
	}
	if (code === '23503') {
		return 'Référence invalide (traducteur, relecteur ou jeu introuvable).';
	}
	if (code === '23505') {
		return 'Conflit : cette valeur existe déjà.';
	}
	return fallback;
}
