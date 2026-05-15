import type { GameTranslationRow } from '$lib/server/api/games-with-translations';
import { db } from '$lib/server/db';
import { translator } from '$lib/server/db/schema';

type TranslatorFkRow = { id: string; name: string };

export type TranslatorFkResolver = (raw: string | null | undefined) => string | null;

/** Résout une FK traducteur/relecteur (id ou nom legacy) vers l’`id` en base. */
export function buildTranslatorFkResolver(rows: TranslatorFkRow[]): TranslatorFkResolver {
	const byId = new Set(rows.map((r) => r.id));
	const byName = new Map(rows.map((r) => [r.name, r.id] as const));
	const byNameLower = new Map(rows.map((r) => [r.name.toLowerCase(), r.id] as const));

	return (raw) => {
		const key = raw?.trim();
		if (!key) return null;
		if (byId.has(key)) return key;
		const byExactName = byName.get(key);
		if (byExactName) return byExactName;
		const byLowerName = byNameLower.get(key.toLowerCase());
		if (byLowerName) return byLowerName;
		return null;
	};
}

let cachedResolver: { resolve: TranslatorFkResolver; at: number } | null = null;
const RESOLVER_CACHE_MS = 60_000;

export async function getTranslatorFkResolver(forceRefresh = false): Promise<TranslatorFkResolver> {
	const now = Date.now();
	if (!forceRefresh && cachedResolver && now - cachedResolver.at < RESOLVER_CACHE_MS) {
		return cachedResolver.resolve;
	}
	const rows = await db.select({ id: translator.id, name: translator.name }).from(translator);
	const resolve = buildTranslatorFkResolver(rows);
	cachedResolver = { resolve, at: now };
	return resolve;
}

export function mapTranslationForPublicApi(
	row: GameTranslationRow,
	resolveFk: TranslatorFkResolver
): GameTranslationRow {
	return {
		...row,
		translatorId: resolveFk(row.translatorId),
		proofreaderId: resolveFk(row.proofreaderId)
	};
}

export async function mapTranslationsForPublicApi(
	rows: GameTranslationRow[]
): Promise<GameTranslationRow[]> {
	if (rows.length === 0) return rows;
	const resolveFk = await getTranslatorFkResolver();
	return rows.map((row) => mapTranslationForPublicApi(row, resolveFk));
}
