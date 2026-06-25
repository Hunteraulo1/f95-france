import type { PublicUpdateRow } from '$lib/server/public-updates';

function toDate(value: unknown): Date {
	if (value instanceof Date) return value;
	if (typeof value === 'string' || typeof value === 'number') {
		const parsed = new Date(value);
		if (!Number.isNaN(parsed.getTime())) return parsed;
	}
	return new Date(0);
}

/** Réhydrate les lignes JSON (`fetch`) : `createdAt` redevient un `Date`. */
export function revivePublicUpdateRow(raw: unknown): PublicUpdateRow {
	const row = raw as PublicUpdateRow;
	return {
		...row,
		createdAt: toDate(row.createdAt),
		game: row.game
	};
}

export function revivePublicUpdateRows(raw: unknown): PublicUpdateRow[] {
	if (!Array.isArray(raw)) return [];
	return raw.map(revivePublicUpdateRow);
}

export function publicUpdateDatetimeAttr(value: Date | string): string {
	const date = toDate(value);
	return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}
