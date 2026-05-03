import type { SQL } from 'drizzle-orm';
import { and, gte, isNotNull, isNull, lte } from 'drizzle-orm';
import { translator } from '$lib/server/db/schema';

export type TranslatorCountFiltersParseResult =
	| { ok: true; where?: SQL }
	| { ok: false; message: string };

/**
 * Filtres optionnels : compteurs (`tradCountMin` / `tradCountMax` / `readCountMin` / `readCountMax`),
 * et `hasDiscord` (true = `discordId` renseigné, false = absent).
 */
export function parseTranslatorCountFilters(searchParams: URLSearchParams): TranslatorCountFiltersParseResult {
	const tMin = parseNonNegInt(searchParams, 'tradCountMin');
	if (!tMin.ok) return tMin;
	const tMax = parseNonNegInt(searchParams, 'tradCountMax');
	if (!tMax.ok) return tMax;
	const rMin = parseNonNegInt(searchParams, 'readCountMin');
	if (!rMin.ok) return rMin;
	const rMax = parseNonNegInt(searchParams, 'readCountMax');
	if (!rMax.ok) return rMax;
	const discord = parseOptionalBool(searchParams, 'hasDiscord');
	if (!discord.ok) return discord;

	const tradCountMin = tMin.value;
	const tradCountMax = tMax.value;
	const readCountMin = rMin.value;
	const readCountMax = rMax.value;
	const hasDiscord = discord.value;

	if (tradCountMin !== undefined && tradCountMax !== undefined && tradCountMin > tradCountMax) {
		return { ok: false, message: 'tradCountMin doit être inférieur ou égal à tradCountMax.' };
	}
	if (readCountMin !== undefined && readCountMax !== undefined && readCountMin > readCountMax) {
		return { ok: false, message: 'readCountMin doit être inférieur ou égal à readCountMax.' };
	}

	const parts: SQL[] = [];
	if (tradCountMin !== undefined) parts.push(gte(translator.tradCount, tradCountMin));
	if (tradCountMax !== undefined) parts.push(lte(translator.tradCount, tradCountMax));
	if (readCountMin !== undefined) parts.push(gte(translator.readCount, readCountMin));
	if (readCountMax !== undefined) parts.push(lte(translator.readCount, readCountMax));
	if (hasDiscord === true) parts.push(isNotNull(translator.discordId));
	if (hasDiscord === false) parts.push(isNull(translator.discordId));

	if (parts.length === 0) return { ok: true };
	const where = parts.length === 1 ? parts[0] : and(...parts);
	return { ok: true, where };
}

function parseNonNegInt(
	searchParams: URLSearchParams,
	name: string
): { ok: true; value?: number } | { ok: false; message: string } {
	const raw = searchParams.get(name);
	if (raw == null || raw.trim() === '') return { ok: true };
	const t = raw.trim();
	if (!/^\d+$/.test(t)) {
		return { ok: false, message: `Paramètre ${name} invalide (entier ≥ 0 attendu).` };
	}
	return { ok: true, value: Number.parseInt(t, 10) };
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
