import type { SQL } from 'drizzle-orm';
import { and, gte, lte } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm';

export type DateRangeParseResult =
	| { ok: true; from?: Date; to?: Date }
	| { ok: false; message: string };

/**
 * Paramètres de requête optionnels `startDate` / `endDate` (ISO 8601).
 * Si la valeur est une date seule `AAAA-MM-JJ` : début = minuit UTC, fin = fin de journée UTC.
 */
export function parseOptionalDateRangeQuery(searchParams: URLSearchParams): DateRangeParseResult {
	const rawFrom = searchParams.get('startDate')?.trim();
	const rawTo = searchParams.get('endDate')?.trim();
	if (!rawFrom && !rawTo) return { ok: true };

	let from: Date | undefined;
	let to: Date | undefined;

	if (rawFrom) {
		const d = parseDateBoundary(rawFrom, 'start');
		if (!d) {
			return {
				ok: false,
				message: 'Paramètre startDate invalide (ISO 8601 ou AAAA-MM-JJ attendu).'
			};
		}
		from = d;
	}
	if (rawTo) {
		const d = parseDateBoundary(rawTo, 'end');
		if (!d) {
			return {
				ok: false,
				message: 'Paramètre endDate invalide (ISO 8601 ou AAAA-MM-JJ attendu).'
			};
		}
		to = d;
	}
	if (from && to && from.getTime() > to.getTime()) {
		return { ok: false, message: 'startDate doit précéder ou égaler endDate.' };
	}
	return { ok: true, from, to };
}

function parseDateBoundary(s: string, kind: 'start' | 'end'): Date | null {
	const t = s.trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
		const iso = kind === 'start' ? `${t}T00:00:00.000Z` : `${t}T23:59:59.999Z`;
		const d = new Date(iso);
		return Number.isNaN(d.getTime()) ? null : d;
	}
	const d = new Date(t);
	return Number.isNaN(d.getTime()) ? null : d;
}

/** Filtre SQL optionnel sur une colonne date (bornes inclusives). */
export function dateRangeOnColumn(column: AnyColumn, from?: Date, to?: Date): SQL | undefined {
	const parts: SQL[] = [];
	if (from) parts.push(gte(column, from));
	if (to) parts.push(lte(column, to));
	if (parts.length === 0) return undefined;
	return parts.length === 1 ? parts[0] : and(...parts);
}
