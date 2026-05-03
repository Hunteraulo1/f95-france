import type { SQL } from 'drizzle-orm';
import { and, eq, isNotNull, not } from 'drizzle-orm';
import { gameTranslation } from '$lib/server/db/schema';

export type TranslationListFiltersResult =
	| { ok: true; where?: SQL }
	| { ok: false; message: string };

const STATUS_MAX = 32;
const GAME_TYPE_MAX = 32;

/**
 * Filtres optionnels pour `GET /api/translations` : `gameId`, `status`, `gameType`,
 * `versionMatchesTversion` (true = `version` non nul et égal à `tversion`).
 */
export function parseTranslationListFilters(searchParams: URLSearchParams): TranslationListFiltersResult {
	const gameIdRaw = searchParams.get('gameId')?.trim();
	const gameId = gameIdRaw && gameIdRaw.length > 0 ? gameIdRaw : undefined;

	const statusRaw = searchParams.get('status')?.trim();
	if (statusRaw && statusRaw.length > STATUS_MAX) {
		return { ok: false, message: `Paramètre status trop long (${STATUS_MAX} caractères maximum).` };
	}

	const gameTypeRaw = searchParams.get('gameType')?.trim();
	if (gameTypeRaw && gameTypeRaw.length > GAME_TYPE_MAX) {
		return { ok: false, message: `Paramètre gameType trop long (${GAME_TYPE_MAX} caractères maximum).` };
	}

	const versionMatch = parseOptionalBool(searchParams, 'versionMatchesTversion');
	if (!versionMatch.ok) return versionMatch;

	const conditions: SQL[] = [];
	if (gameId) conditions.push(eq(gameTranslation.gameId, gameId));
	if (statusRaw) conditions.push(eq(gameTranslation.status, statusRaw));
	if (gameTypeRaw) conditions.push(eq(gameTranslation.gameType, gameTypeRaw));
	if (versionMatch.value === true || versionMatch.value === false) {
		const versionSynced = and(
			isNotNull(gameTranslation.version),
			eq(gameTranslation.version, gameTranslation.tversion)
		)!;
		conditions.push(versionMatch.value ? versionSynced : not(versionSynced));
	}

	if (conditions.length === 0) return { ok: true };
	const where = conditions.length === 1 ? conditions[0] : and(...conditions);
	return { ok: true, where };
}

function parseOptionalBool(
	searchParams: URLSearchParams,
	name: string
): { ok: true; value?: boolean } | { ok: false; message: string } {
	const raw = searchParams.get(name);
	if (raw == null || raw.trim() === '') return { ok: true };
	const v = raw.trim().toLowerCase();
	if (v === 'true' || v === '1' || v === 'yes') return { ok: true, value: true };
	if (v === 'false' || v === '0' || v === 'no') return { ok: true, value: false };
	return { ok: false, message: `Paramètre ${name} invalide (true ou false attendu).` };
}
