import { sql, type Column } from 'drizzle-orm';

/** Échappe `%`, `_` et `\` pour un motif SQL LIKE. */
export function escapeLikePattern(value: string): string {
	return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * LIKE insensible à la casse, indépendamment de la collation MariaDB
 * (ex. `utf8mb4_bin` en prod/PTB vs `utf8mb4_unicode_ci` en dev local).
 */
export function caseInsensitiveLike(column: Column, rawQuery: string) {
	const pattern = `%${escapeLikePattern(rawQuery)}%`;
	return sql`lower(${column}) like lower(${pattern})`;
}
