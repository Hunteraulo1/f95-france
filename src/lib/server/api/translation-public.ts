import type { GameTranslationRow } from '$lib/server/api/games-with-translations';
import { db } from '$lib/server/db';
import { game, translator } from '$lib/server/db/schema';
import { strTrim } from '$lib/server/translation-notify-rules';
import { inArray } from 'drizzle-orm';

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

/** Version de référence exposée par l’API : traduction, sinon version du jeu. */
export function effectiveTranslationVersion(
	rowVersion: string | null,
	gameVersion: string | null | undefined
): string | null {
	const ref = strTrim(rowVersion);
	if (ref) return ref;
	const gv = strTrim(gameVersion);
	return gv || null;
}

async function loadGameVersionsByGameIds(gameIds: string[]): Promise<Map<string, string | null>> {
	const unique = [...new Set(gameIds)];
	if (unique.length === 0) return new Map();
	const rows = await db
		.select({ id: game.id, gameVersion: game.gameVersion })
		.from(game)
		.where(inArray(game.id, unique));
	return new Map(rows.map((r) => [r.id, r.gameVersion]));
}

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
	resolveFk: TranslatorFkResolver,
	gameVersionByGameId: Map<string, string | null>
): GameTranslationRow {
	return {
		...row,
		version: effectiveTranslationVersion(row.version, gameVersionByGameId.get(row.gameId)),
		translatorId: resolveFk(row.translatorId),
		proofreaderId: resolveFk(row.proofreaderId)
	};
}

export async function mapTranslationsForPublicApi(
	rows: GameTranslationRow[]
): Promise<GameTranslationRow[]> {
	if (rows.length === 0) return rows;
	const resolveFk = await getTranslatorFkResolver();
	const gameVersionByGameId = await loadGameVersionsByGameIds(rows.map((r) => r.gameId));
	return rows.map((row) => mapTranslationForPublicApi(row, resolveFk, gameVersionByGameId));
}
