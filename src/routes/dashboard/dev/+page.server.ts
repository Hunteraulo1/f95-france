import { env } from '$env/dynamic/private';
import {
	getEffectiveConfig,
	getEffectiveConfigFromRow,
	toConfigClientSafe
} from '$lib/server/app-config';
import { db } from '$lib/server/db';
import { runAutoCheckVersions } from '$lib/server/check-version';
import * as table from '$lib/server/db/schema';
import { getValidAccessToken } from '$lib/server/google-oauth';
import {
	deleteGameTranslationsFromGoogleSheet,
	syncDbToSpreadsheetBulk
} from '$lib/server/google-sheets-sync';
import { scrapeF95Thread } from '$lib/server/scrape/f95';
import type { Config } from '@sveltejs/adapter-vercel';
import { eq, inArray, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

/**
 * Sync legacy + Sheets peut être long (Apps Script froid, gros JSON).
 * Vercel Hobby : maxDuration plafonné à 300s (plan Pro permet jusqu’à 900s sur certaines régions).
 */
export const config: Config = {
	maxDuration: 300,
	split: true
};

const LEGACY_API_URL =
	env.LEGACY_API_URL ||
	'https://script.google.com/macros/s/AKfycbybvrFy6B2L7rkLWJnrwRHhP0F6Sv0uk6V9zUTZibwEzUjKXf-abOK_N6jUhqFPs9US/exec';

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
	if (raw == null || raw === '') return fallback;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Timeout par tentative vers LEGACY_API_URL (ms). */
const LEGACY_FETCH_TIMEOUT_MS = parsePositiveInt(env.LEGACY_API_FETCH_TIMEOUT_MS, 420_000);
/** Nombre de nouvelles tentatives après un échec (ex. 2 → 3 essais au total). */
const LEGACY_FETCH_RETRIES = Math.min(
	Math.max(parsePositiveInt(env.LEGACY_API_FETCH_RETRIES, 2), 0),
	5
);

function describeLegacyFetchError(err: unknown, timeoutMs: number): string {
	if (
		(typeof DOMException !== 'undefined' &&
			err instanceof DOMException &&
			err.name === 'TimeoutError') ||
		(err instanceof Error && err.name === 'TimeoutError')
	) {
		return `Timeout après ${timeoutMs / 1000}s vers l’API legacy (LEGACY_API_FETCH_TIMEOUT_MS).`;
	}
	if (err instanceof TypeError && err.message === 'fetch failed') {
		const c = err.cause;
		if (c instanceof Error) return `fetch failed — ${c.name}: ${c.message}`;
		if (typeof c === 'object' && c !== null && 'code' in c)
			return `fetch failed — code ${String((c as { code: unknown }).code)}`;
		return 'fetch failed — cause inconnue (réseau, DNS, TLS ou fonction hébergée coupée ~300s).';
	}
	if (err instanceof Error) return err.message;
	return String(err);
}

/**
 * GET vers l’Apps Script legacy : timeout long, retries. Ne pas utiliser fetch() nu.
 */
async function fetchLegacyApiGet(progress?: (message: string) => void): Promise<Response> {
	const attempts = 1 + LEGACY_FETCH_RETRIES;
	let lastErr: unknown;
	for (let i = 0; i < attempts; i++) {
		if (i > 0) {
			const delay = Math.min(3000 * (1 << (i - 1)), 25_000);
			progress?.(
				`Échec réseau / timeout, nouvelle tentative dans ${delay / 1000}s (${i + 1}/${attempts})…`
			);
			await new Promise((r) => setTimeout(r, delay));
		}
		try {
			if (i > 0) {
				progress?.(
					`Requête HTTP GET (tentative ${i + 1}/${attempts}), timeout ${LEGACY_FETCH_TIMEOUT_MS / 1000}s…`
				);
			}
			return await fetch(LEGACY_API_URL, {
				signal: AbortSignal.timeout(LEGACY_FETCH_TIMEOUT_MS),
				headers: { Accept: 'application/json' }
			});
		} catch (e) {
			lastErr = e;
		}
	}
	throw new Error(
		`${describeLegacyFetchError(lastErr, LEGACY_FETCH_TIMEOUT_MS)} — Indice : sur Vercel Pro, max 900s pour cette route ; l’API Google Apps Script peut mettre plusieurs minutes au premier appel.`
	);
}

type LegacyGame = {
	id?: number | string;
	domain?: string | null;
	name?: string | null;
	version?: string | null;
	tversion?: string | null;
	tname?: string | null;
	status?: string | null;
	tags?: string[] | string | null;
	type?: string | null;
	traductor?: string | null;
	proofreader?: string | null;
	ttype?: string | null;
	ac?: boolean | null;
	image?: string | null;
	link?: string | null;
	tlink?: string | null;
};

type LegacyTranslatorPage = { title?: string | null; name?: string | null; link?: string | null };

type LegacyTranslator = {
	id?: string | number | null;
	name?: string | number | null;
	discordId?: string | number | null;
	pages?: string[] | string | LegacyTranslatorPage[] | null;
	tradCount?: number | string | null;
	readCount?: number | string | null;
};

const normalizeLegacyText = (value: string | null | undefined): string =>
	(value ?? '')
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.trim();

const mapType = (value: string | null | undefined): string => {
	const normalized = normalizeLegacyText(value);
	if (normalized.includes('renpy')) return 'renpy';
	if (normalized.includes('rpg')) return 'rpgm';
	if (normalized.includes('unity')) return 'unity';
	if (normalized.includes('unreal')) return 'unreal';
	if (normalized.includes('flash')) return 'flash';
	// Ancien sheet / typo « HTLM » : traiter comme HTML (substring « html » ne matche pas « htlm »).
	if (normalized.includes('html') || normalized.includes('htlm')) return 'html';
	if (normalized.includes('qsp')) return 'qsp';
	return 'other';
};

const mapStatus = (value: string | null | undefined): string => {
	const normalized = normalizeLegacyText(value);
	if (normalized.includes('aband')) return 'abandoned';
	if (normalized.includes('termin') || normalized.includes('complete')) return 'completed';
	return 'in_progress';
};

const mapTName = (value: string | null | undefined): string => {
	const normalized = normalizeLegacyText(value);
	if (normalized.includes('integr')) return 'integrated';
	if (normalized.includes('mod')) return 'translation_with_mods';
	if (normalized.includes('trad')) return 'translation';
	return 'no_translation';
};

const mapTType = (value: string | null | undefined): string | null => {
	const normalized = normalizeLegacyText(value);
	if (!normalized) return null;
	if (normalized.includes('semi')) return 'semi-auto';
	if (
		normalized.includes('vf') ||
		normalized.includes('francais') ||
		normalized.includes('francaise')
	)
		return 'vf';
	if (
		normalized.includes('humaine') ||
		normalized.includes('humain') ||
		normalized.includes('human') ||
		normalized.includes('manuel') ||
		normalized.includes('manuelle') ||
		normalized.includes('manual')
	)
		return 'manual';
	if (normalized.includes('test')) return 'to_tested';
	if (
		normalized.includes(' hs') ||
		normalized.startsWith('hs') ||
		normalized.includes('hors service')
	)
		return 'hs';
	if (normalized.includes('auto')) return 'auto';
	return null;
};

/** Si `tname` est absent côté API mais qu’il y a un lien / un type de trad, ce n’est pas « pas de traduction ». */
const inferLegacyTName = (item: LegacyGame): string => {
	const fromField = mapTName(item.tname);
	if (fromField !== 'no_translation') return fromField;
	if (item.tlink?.trim()) return 'translation';
	if (mapTType(item.ttype) != null) return 'translation';
	return 'no_translation';
};

const mapWebsite = (value: string | null | undefined): 'f95z' | 'lc' | 'other' => {
	const normalized = normalizeLegacyText(value);
	if (normalized.includes('f95')) return 'f95z';
	if (normalized.includes('lewd') || normalized === 'lc') return 'lc';
	return 'other';
};

const parseLegacyBoolean = (value: unknown): boolean => {
	if (value === true) return true;
	if (value === false || value == null) return false;
	if (typeof value === 'number') return value === 1;
	if (typeof value === 'string') {
		const n = normalizeLegacyText(value);
		return n === 'true' || n === '1' || n === 'oui' || n === 'yes' || n === 'y';
	}
	return false;
};

const parseLegacyGames = (input: unknown): LegacyGame[] | null => {
	if (Array.isArray(input)) return input as LegacyGame[];
	if (
		typeof input === 'object' &&
		input !== null &&
		'games' in input &&
		Array.isArray((input as { games?: unknown }).games)
	) {
		return (input as { games: LegacyGame[] }).games;
	}
	return null;
};

const parseLegacyTranslators = (input: unknown): LegacyTranslator[] | null => {
	if (
		typeof input === 'object' &&
		input !== null &&
		'data' in input &&
		typeof (input as { data?: unknown }).data === 'object' &&
		(input as { data?: unknown }).data !== null &&
		'traductors' in ((input as { data: { traductors?: unknown } }).data ?? {}) &&
		Array.isArray((input as { data: { traductors?: unknown[] } }).data.traductors)
	) {
		return (input as { data: { traductors: LegacyTranslator[] } }).data.traductors;
	}
	return null;
};

const safeNumber = (value: unknown): number | null => {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
};

/** Same shape as le tableau édité dans /dashboard/translators : { name, link }[] */
const parsePages = (value: unknown): string => {
	const normalizeEntry = (entry: unknown): { name: string; link: string } | null => {
		if (typeof entry === 'string') {
			const link = entry.trim();
			if (!link) return null;
			return { name: '', link };
		}
		if (entry && typeof entry === 'object') {
			const o = entry as Record<string, unknown>;
			const linkRaw =
				(typeof o.link === 'string' && o.link.trim()) ||
				(typeof o.url === 'string' && o.url.trim()) ||
				(typeof o.href === 'string' && o.href.trim()) ||
				'';
			const nameRaw =
				(typeof o.name === 'string' && o.name.trim()) ||
				(typeof o.title === 'string' && o.title.trim()) ||
				(typeof o.label === 'string' && o.label.trim()) ||
				'';
			if (!linkRaw && !nameRaw) return null;
			return { name: nameRaw, link: linkRaw };
		}
		return null;
	};

	if (Array.isArray(value)) {
		const out = value
			.map(normalizeEntry)
			.filter((x): x is { name: string; link: string } => x !== null);
		return JSON.stringify(out);
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) return '[]';
		try {
			const parsed: unknown = JSON.parse(trimmed);
			if (Array.isArray(parsed)) {
				const out = parsed
					.map(normalizeEntry)
					.filter((x): x is { name: string; link: string } => x !== null);
				return JSON.stringify(out);
			}
		} catch {
			return JSON.stringify(
				trimmed
					.split(',')
					.map((v) => v.trim())
					.filter((v) => v.length > 0)
					.map((link) => ({ name: '', link }))
			);
		}
	}
	return '[]';
};

const upsertLegacyTranslators = async (
	translators: LegacyTranslator[],
	options: { dryRun?: boolean } = {}
) => {
	const dryRun = options.dryRun === true;
	let inserted = 0;
	let updated = 0;
	let skipped = 0;

	const existing = await db
		.select({
			id: table.translator.id,
			name: table.translator.name,
			discordId: table.translator.discordId,
			pages: table.translator.pages,
			tradCount: table.translator.tradCount,
			readCount: table.translator.readCount
		})
		.from(table.translator);

	const byName = new Map<string, (typeof existing)[number]>();
	const byDiscordId = new Map<string, (typeof existing)[number]>();

	for (const row of existing) {
		byName.set(row.name.toLowerCase(), row);
		if (row.discordId) byDiscordId.set(row.discordId, row);
	}

	for (const item of translators) {
		const name =
			typeof item.name === 'string'
				? item.name.trim()
				: typeof item.name === 'number'
					? String(item.name).trim()
					: '';
		if (!name) {
			skipped++;
			continue;
		}

		const discordId =
			typeof item.discordId === 'string'
				? item.discordId.trim() || null
				: typeof item.discordId === 'number'
					? String(item.discordId)
					: null;
		const pages = parsePages(item.pages);
		const tradCount = safeNumber(item.tradCount) ?? 0;
		const readCount = safeNumber(item.readCount) ?? 0;

		let current =
			(discordId ? byDiscordId.get(discordId) : undefined) ??
			byName.get(name.toLowerCase()) ??
			null;

		if (!current) {
			const id = crypto.randomUUID();
			if (!dryRun) {
				await db.insert(table.translator).values({
					id,
					name,
					discordId,
					pages,
					tradCount,
					readCount
				});
			}
			const created = { id, name, discordId, pages, tradCount, readCount };
			byName.set(name.toLowerCase(), created);
			if (discordId) byDiscordId.set(discordId, created);
			inserted++;
			continue;
		}

		const shouldUpdate =
			current.name !== name ||
			(current.discordId ?? null) !== discordId ||
			current.pages !== pages ||
			current.tradCount !== tradCount ||
			current.readCount !== readCount;

		if (!shouldUpdate) continue;

		if (!dryRun) {
			await db
				.update(table.translator)
				.set({
					name,
					discordId,
					pages,
					tradCount,
					readCount
				})
				.where(eq(table.translator.id, current.id));
		}

		current = { ...current, name, discordId, pages, tradCount, readCount };
		byName.set(name.toLowerCase(), current);
		if (discordId) byDiscordId.set(discordId, current);
		updated++;
	}

	return {
		total: translators.length,
		inserted,
		updated,
		skipped
	};
};

const normalizeKeyPart = (value: string | null | undefined): string =>
	(value ?? '')
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.replace(/\s+/g, ' ');

const translationStrictKeyFromLegacy = (
	gameId: string,
	tversionKey: string | null | undefined,
	tlinkKey: string | null | undefined
): string => `${gameId}:${normalizeKeyPart(tversionKey)}:${normalizeKeyPart(tlinkKey)}`;

type TranslationRowForDedupe = {
	id: string;
	gameId: string;
	tversion: string;
	tlink: string;
	updatedAt: Date;
	createdAt: Date;
};

/**
 * Supprime les traductions en double : même jeu + même clé stricte (tversion + tlink normalisés)
 * que l’import legacy. Conserve la ligne la plus récemment mise à jour ; réassigne les soumissions.
 */
async function dedupeStrictDuplicateTranslations(
	options: {
		dryRun?: boolean;
	} = {}
): Promise<{ removed: number; duplicateIds: string[] }> {
	const dryRun = options.dryRun === true;
	const rows = await db
		.select({
			id: table.gameTranslation.id,
			gameId: table.gameTranslation.gameId,
			tversion: table.gameTranslation.tversion,
			tlink: table.gameTranslation.tlink,
			updatedAt: table.gameTranslation.updatedAt,
			createdAt: table.gameTranslation.createdAt
		})
		.from(table.gameTranslation);

	const byKey = new Map<string, TranslationRowForDedupe[]>();
	for (const r of rows) {
		const tlinkNorm = typeof r.tlink === 'string' ? r.tlink.trim() : (r.tlink ?? '');
		const k = translationStrictKeyFromLegacy(r.gameId, r.tversion, tlinkNorm);
		const list = byKey.get(k) ?? [];
		list.push({
			id: r.id,
			gameId: r.gameId,
			tversion: r.tversion,
			tlink: tlinkNorm,
			updatedAt: r.updatedAt,
			createdAt: r.createdAt
		});
		byKey.set(k, list);
	}

	const duplicateIds: string[] = [];
	const remap: Array<{ dropId: string; keepId: string }> = [];

	for (const [, list] of byKey) {
		if (list.length <= 1) continue;
		list.sort((a, b) => {
			const u = b.updatedAt.getTime() - a.updatedAt.getTime();
			if (u !== 0) return u;
			const c = b.createdAt.getTime() - a.createdAt.getTime();
			if (c !== 0) return c;
			return b.id.localeCompare(a.id);
		});
		const keeper = list[0]!;
		for (let i = 1; i < list.length; i++) {
			const drop = list[i]!;
			duplicateIds.push(drop.id);
			remap.push({ dropId: drop.id, keepId: keeper.id });
		}
	}

	if (duplicateIds.length === 0 || dryRun) {
		return { removed: duplicateIds.length, duplicateIds };
	}

	await db.transaction(async (tx) => {
		for (const { dropId, keepId } of remap) {
			await tx
				.update(table.submission)
				.set({ translationId: keepId })
				.where(eq(table.submission.translationId, dropId));
		}
		await tx.delete(table.gameTranslation).where(inArray(table.gameTranslation.id, duplicateIds));
	});

	return { removed: duplicateIds.length, duplicateIds };
}

const chooseCanonicalGameName = (currentName: string, incomingName: string): string => {
	const curr = currentName.trim();
	const inc = incomingName.trim();
	if (!curr) return inc;
	if (!inc) return curr;
	const currNorm = normalizeKeyPart(curr);
	const incNorm = normalizeKeyPart(inc);
	if (!currNorm || !incNorm) return curr;
	if (currNorm === incNorm) return curr;
	// Si l'un est un préfixe normalisé de l'autre, on garde le nom le plus court (nom "racine" du jeu).
	if (currNorm.startsWith(`${incNorm} `)) return inc;
	if (incNorm.startsWith(`${currNorm} `)) return curr;
	return curr;
};

/** Évite '' en base si une FK translator existe côté Postgres (UUID vide = violation). */
const normOptionalTranslatorFk = (id: string | null | undefined): string | null =>
	id != null && String(id).trim() !== '' ? String(id).trim() : null;

const extractLegacyTranslationName = (
	gameName: string,
	legacyItemName: string | null | undefined
): string | null => {
	const base = (gameName ?? '').trim();
	const raw = (legacyItemName ?? '').trim();
	if (!base || !raw) return null;
	const baseNorm = normalizeKeyPart(base);
	const rawNorm = normalizeKeyPart(raw);
	if (!baseNorm || !rawNorm || rawNorm === baseNorm) return null;
	if (!rawNorm.startsWith(`${baseNorm} `)) return null;
	let suffix = raw.slice(base.length).trim();
	suffix = suffix.replace(/^[\s\-–—:|]+/, '').trim();
	return suffix || null;
};

const upsertLegacyGames = async (
	games: LegacyGame[],
	options: { dryRun?: boolean; progress?: (message: string) => void } = {}
) => {
	const dryRun = options.dryRun === true;
	const { progress } = options;
	let insertedGames = 0;
	let updatedGames = 0;
	let insertedTranslations = 0;
	let updatedTranslations = 0;
	let deletedTranslations = 0;
	let dedupedTranslations = 0;
	let createdTranslators = 0;
	let createdProofreaders = 0;
	let skipped = 0;

	progress?.(`Import DB : ${games.length} ligne(s) legacy à traiter`);
	progress?.('Chargement jeux / traducteurs / traductions existants…');

	const existingGames = await db
		.select({
			id: table.game.id,
			threadId: table.game.threadId,
			website: table.game.website,
			link: table.game.link,
			name: table.game.name,
			tags: table.game.tags,
			image: table.game.image,
			gameVersion: table.game.gameVersion
		})
		.from(table.game);
	const gamesByThread = new Map<string, string>();
	const gamesByLink = new Map<string, string>();
	const gamesSnapshot = new Map<string, (typeof existingGames)[number]>();
	for (const game of existingGames) {
		gamesSnapshot.set(game.id, game);
		if (game.threadId !== null && game.threadId !== undefined) {
			gamesByThread.set(`${game.website}:${game.threadId}`, game.id);
		}
		if (game.link) gamesByLink.set(game.link, game.id);
	}

	const existingTranslators = await db
		.select({ id: table.translator.id, name: table.translator.name })
		.from(table.translator);
	const translatorByName = new Map<string, string>();
	for (const row of existingTranslators) {
		translatorByName.set(row.name.toLowerCase(), row.id);
	}

	const existingTranslations = await db
		.select({
			id: table.gameTranslation.id,
			gameId: table.gameTranslation.gameId,
			tversion: table.gameTranslation.tversion,
			tlink: table.gameTranslation.tlink
		})
		.from(table.gameTranslation);
	const translationByStrictKey = new Map<string, string>();
	for (const row of existingTranslations) {
		translationByStrictKey.set(
			translationStrictKeyFromLegacy(row.gameId, row.tversion, row.tlink),
			row.id
		);
	}
	const gameAcStats = new Map<string, { total: number; hasAcTrue: boolean }>();
	/** Clés strictes présentes dans le payload legacy (aligné sur upsert : tversion + tlink). */
	const legacyStrictKeys = new Set<string>();

	/** Pour sync Sheets partielle : traductions dont la ligne Jeux peut avoir changé. */
	const jeuxSheetTouchIds = new Set<string>();
	const translationIdsByGameId = new Map<string, string[]>();
	for (const row of existingTranslations) {
		const arr = translationIdsByGameId.get(row.gameId) ?? [];
		arr.push(row.id);
		translationIdsByGameId.set(row.gameId, arr);
	}

	const GAME_INS_BATCH = 80;
	const TR_INS_BATCH = 60;
	const TRANS_INS_BATCH = 80;
	const UPD_CONCURRENCY = 40;
	/** Maj traductions : parallélisme modéré pour limiter les deadlocks (vs 40 en même temps). */
	const TRANS_UPD_PARALLEL = 16;

	const bufGameIns: (typeof table.game.$inferInsert)[] = [];
	const bufTrIns: (typeof table.translator.$inferInsert)[] = [];
	const bufTransIns: (typeof table.gameTranslation.$inferInsert)[] = [];
	const qGameUpd: Array<{ id: string; values: Partial<typeof table.game.$inferInsert> }> = [];
	const pendingTransUpdates: Promise<unknown>[] = [];

	const flushGameInserts = async () => {
		if (dryRun || bufGameIns.length === 0) return;
		await db.insert(table.game).values(bufGameIns);
		bufGameIns.length = 0;
	};
	const flushTrInserts = async () => {
		if (dryRun || bufTrIns.length === 0) return;
		await db.insert(table.translator).values(bufTrIns);
		bufTrIns.length = 0;
	};
	const flushTransInserts = async () => {
		if (dryRun || bufTransIns.length === 0) return;
		await db.insert(table.gameTranslation).values(bufTransIns);
		bufTransIns.length = 0;
	};
	const flushBeforeTranslationWrite = async () => {
		// Appliquer d’abord les maj jeu en attente : les INSERT traduction vérifient le FK game_id.
		await drainGameUpdates();
		await flushGameInserts();
		await flushTrInserts();
	};
	const drainGameUpdates = async () => {
		if (dryRun) {
			qGameUpd.length = 0;
			return;
		}
		while (qGameUpd.length > 0) {
			const chunk = qGameUpd.splice(0, UPD_CONCURRENCY);
			await Promise.all(
				chunk.map(({ id, values }) =>
					db.update(table.game).set(values).where(eq(table.game.id, id))
				)
			);
		}
	};
	const flushTransUpdates = async () => {
		if (dryRun || pendingTransUpdates.length === 0) return;
		const batch = pendingTransUpdates.splice(0, pendingTransUpdates.length);
		for (let i = 0; i < batch.length; i += TRANS_UPD_PARALLEL) {
			const chunk = batch.slice(i, i + TRANS_UPD_PARALLEL);
			await Promise.all(chunk);
		}
	};

	progress?.(
		`Cache chargé : ${existingGames.length} jeu(x), ${existingTranslators.length} personne(s), ${existingTranslations.length} traduction(s)`
	);

	let legacyRow = 0;
	for (const item of games) {
		legacyRow++;
		if (legacyRow === 1 || legacyRow % 500 === 0 || legacyRow === games.length) {
			progress?.(`Traitement legacy ${legacyRow}/${games.length}`);
		}
		const threadId =
			typeof item.id === 'number'
				? item.id
				: typeof item.id === 'string'
					? Number.parseInt(item.id, 10)
					: null;
		const name = item.name?.trim();
		const link = item.link?.trim() ?? '';
		const website = mapWebsite(item.domain);

		if (!name) {
			skipped++;
			continue;
		}

		let gameId: string | undefined;
		if (threadId && Number.isFinite(threadId)) gameId = gamesByThread.get(`${website}:${threadId}`);
		if (!gameId && link) gameId = gamesByLink.get(link);

		const tags = Array.isArray(item.tags)
			? item.tags.join(', ')
			: typeof item.tags === 'string'
				? item.tags
				: '';
		const gameVersion =
			typeof item.version === 'string' && item.version.trim() ? item.version.trim() : null;

		const rowGameType = mapType(item.type);

		if (gameId) {
			const prev = gamesSnapshot.get(gameId);
			const nextValues = {
				name: prev?.name ? chooseCanonicalGameName(prev.name, name) : name,
				tags,
				image: item.image?.trim() || '',
				website,
				threadId: threadId && Number.isFinite(threadId) ? threadId : null,
				link,
				gameVersion
			};
			if (
				!prev ||
				prev.name !== nextValues.name ||
				prev.tags !== nextValues.tags ||
				prev.image !== nextValues.image ||
				prev.website !== nextValues.website ||
				prev.threadId !== nextValues.threadId ||
				prev.link !== nextValues.link ||
				(prev.gameVersion ?? null) !== (nextValues.gameVersion ?? null)
			) {
				if (!dryRun) {
					qGameUpd.push({ id: gameId, values: nextValues });
					if (qGameUpd.length >= UPD_CONCURRENCY) await drainGameUpdates();
				}
				for (const tid of translationIdsByGameId.get(gameId) ?? []) {
					jeuxSheetTouchIds.add(tid);
				}
				gamesSnapshot.set(gameId, { ...(prev ?? { id: gameId }), ...nextValues });
				updatedGames++;
			}
		} else {
			gameId = crypto.randomUUID();
			const row = {
				id: gameId,
				name,
				tags,
				image: item.image?.trim() || '',
				website,
				threadId: threadId && Number.isFinite(threadId) ? threadId : null,
				link,
				gameAutoCheck: website === 'f95z',
				gameVersion
			};
			if (!dryRun) {
				bufGameIns.push(row);
				if (bufGameIns.length >= GAME_INS_BATCH) await flushGameInserts();
			}
			gamesSnapshot.set(gameId, row);
			if (row.threadId !== null) gamesByThread.set(`${row.website}:${row.threadId}`, gameId);
			if (row.link) gamesByLink.set(row.link, gameId);
			insertedGames++;
		}

		const translatorName = item.traductor?.trim();
		let translatorId: string | null = null;
		if (translatorName) {
			translatorId = translatorByName.get(translatorName.toLowerCase()) ?? null;
			if (!translatorId) {
				translatorId = dryRun ? `dry-tr-${translatorName.toLowerCase()}` : crypto.randomUUID();
				if (!dryRun) {
					bufTrIns.push({ id: translatorId, name: translatorName, pages: '[]' });
					if (bufTrIns.length >= TR_INS_BATCH) await flushTrInserts();
				}
				translatorByName.set(translatorName.toLowerCase(), translatorId);
				createdTranslators++;
			}
		}

		const proofreaderName = item.proofreader?.trim();
		let proofreaderId: string | null = null;
		if (proofreaderName) {
			proofreaderId = translatorByName.get(proofreaderName.toLowerCase()) ?? null;
			if (!proofreaderId) {
				proofreaderId = dryRun ? `dry-pr-${proofreaderName.toLowerCase()}` : crypto.randomUUID();
				if (!dryRun) {
					bufTrIns.push({ id: proofreaderId, name: proofreaderName, pages: '[]' });
					if (bufTrIns.length >= TR_INS_BATCH) await flushTrInserts();
				}
				translatorByName.set(proofreaderName.toLowerCase(), proofreaderId);
				createdProofreaders++;
			}
		}

		translatorId = normOptionalTranslatorFk(translatorId);
		proofreaderId = normOptionalTranslatorFk(proofreaderId);

		const tversion = item.tversion?.trim() || 'unknown';
		const acValue = parseLegacyBoolean(item.ac);
		// Version du jeu pour cette ligne (colonne VERSION du sheet) : toujours stockée par traduction,
		// y compris si AC=true, pour que la sync affiche la bonne version quand il y a plusieurs traductions.
		const translationGameVersion = gameVersion;
		const canonicalGameName = gamesSnapshot.get(gameId)?.name ?? name;
		const translationName = extractLegacyTranslationName(canonicalGameName, name);
		const tlinkValue = item.tlink?.trim() || '';
		const strictKey = translationStrictKeyFromLegacy(gameId, tversion, tlinkValue);
		legacyStrictKeys.add(strictKey);
		// Ne pas matcher par (gameId + tversion) seul : plusieurs traductions peuvent partager la même version (auto vs manuelle, etc.).
		const existingTranslationId = translationByStrictKey.get(strictKey);
		const mappedTType = mapTType(item.ttype);
		const stat = gameAcStats.get(gameId) ?? { total: 0, hasAcTrue: false };
		stat.total += 1;
		stat.hasAcTrue = stat.hasAcTrue || acValue;
		gameAcStats.set(gameId, stat);

		if (!existingTranslationId) {
			const newTranslationId = dryRun ? `dry-tr-${strictKey.slice(0, 24)}` : crypto.randomUUID();
			if (!dryRun) {
				await flushBeforeTranslationWrite();
				bufTransIns.push({
					id: newTranslationId,
					gameId,
					translationName,
					version: translationGameVersion,
					status: mapStatus(item.status),
					tversion,
					tlink: item.tlink?.trim() || '',
					tname: inferLegacyTName(item),
					translatorId,
					proofreaderId,
					ttype: mappedTType ?? 'manual',
					gameType: rowGameType,
					ac: acValue
				});
				if (bufTransIns.length >= TRANS_INS_BATCH) await flushTransInserts();
				const arr = translationIdsByGameId.get(gameId) ?? [];
				arr.push(newTranslationId);
				translationIdsByGameId.set(gameId, arr);
			}
			translationByStrictKey.set(strictKey, newTranslationId);
			insertedTranslations++;
			jeuxSheetTouchIds.add(newTranslationId);
		} else {
			if (!dryRun) {
				await flushBeforeTranslationWrite();
				pendingTransUpdates.push(
					db
						.update(table.gameTranslation)
						.set({
							gameId,
							translationName,
							version: translationGameVersion,
							status: item.status?.trim()
								? mapStatus(item.status)
								: sql`${table.gameTranslation.status}`,
							tversion,
							tlink: item.tlink?.trim() || '',
							tname: inferLegacyTName(item),
							translatorId,
							proofreaderId,
							ttype: mappedTType ?? sql`${table.gameTranslation.ttype}`,
							gameType: rowGameType,
							ac: acValue
						})
						.where(eq(table.gameTranslation.id, existingTranslationId))
				);
				if (pendingTransUpdates.length >= UPD_CONCURRENCY) await flushTransUpdates();
			}
			updatedTranslations++;
			jeuxSheetTouchIds.add(existingTranslationId);
		}
	}

	if (!dryRun) {
		await flushGameInserts();
		await flushTrInserts();
		await flushTransInserts();
		await drainGameUpdates();
		await flushTransUpdates();
	}

	progress?.(
		`Boucle legacy terminée : ${skipped} ignorée(s), purge sur ${gameAcStats.size} jeu(x) touché(s)`
	);

	// Legacy = référence : pour chaque jeu concerné par ce flux, supprimer les traductions absentes du payload.
	const purgeGameIds = [...gameAcStats.keys()];
	if (purgeGameIds.length > 0) {
		const allPurgeRows = await db
			.select({
				id: table.gameTranslation.id,
				gameId: table.gameTranslation.gameId,
				tversion: table.gameTranslation.tversion,
				tlink: table.gameTranslation.tlink
			})
			.from(table.gameTranslation)
			.where(inArray(table.gameTranslation.gameId, purgeGameIds));

		const byGame = new Map<string, typeof allPurgeRows>();
		for (const r of allPurgeRows) {
			const list = byGame.get(r.gameId) ?? [];
			list.push(r);
			byGame.set(r.gameId, list);
		}

		for (const gid of purgeGameIds) {
			const rows = byGame.get(gid) ?? [];
			const idsToDelete = rows
				.filter((r) => {
					const tlinkNorm = typeof r.tlink === 'string' ? r.tlink.trim() : (r.tlink ?? '');
					return !legacyStrictKeys.has(translationStrictKeyFromLegacy(gid, r.tversion, tlinkNorm));
				})
				.map((r) => r.id);

			if (idsToDelete.length === 0) continue;
			deletedTranslations += idsToDelete.length;
			if (!dryRun) {
				await db
					.update(table.submission)
					.set({ translationId: null })
					.where(inArray(table.submission.translationId, idsToDelete));
				await db
					.delete(table.gameTranslation)
					.where(inArray(table.gameTranslation.id, idsToDelete));
			}
		}
	}

	if (deletedTranslations > 0) {
		progress?.(
			`Purge payload : ${deletedTranslations} traduction(s) retirée(s) (absentes du legacy)`
		);
	} else {
		progress?.('Purge payload : aucune traduction à retirer');
	}

	// Même clé stricte que l’import : supprime les doublons restants en base (ex. imports anciens).
	if (!dryRun) {
		progress?.('Déduplication stricte en base + nettoyage lignes Sheet…');
		const { removed, duplicateIds } = await dedupeStrictDuplicateTranslations();
		dedupedTranslations = removed;
		if (duplicateIds.length > 0) {
			try {
				await deleteGameTranslationsFromGoogleSheet(duplicateIds);
			} catch (err) {
				console.warn('Dédup traductions : suppression Google Sheet ignorée', err);
			}
		}
		if (dedupedTranslations > 0) {
			progress?.(`Dédup : ${dedupedTranslations} ligne(s) fusionnée(s)`);
		} else {
			progress?.('Dédup : aucun doublon strict restant');
		}
	}

	// Règle legacy: si toutes les traductions d'un jeu ont AC=false, alors gameAutoCheck=false.
	if (!dryRun) {
		const gacIds: string[] = [];
		for (const [gameId, stat] of gameAcStats) {
			if (stat.total > 0 && !stat.hasAcTrue) gacIds.push(gameId);
		}
		if (gacIds.length > 0) {
			progress?.(`Mise à jour gameAutoCheck (${gacIds.length} jeu(x) sans AC=true)…`);
			for (let i = 0; i < gacIds.length; i += UPD_CONCURRENCY) {
				const chunk = gacIds.slice(i, i + UPD_CONCURRENCY);
				await Promise.all(
					chunk.map((gameId) =>
						db
							.update(table.game)
							.set({ gameAutoCheck: false, updatedAt: new Date() })
							.where(eq(table.game.id, gameId))
					)
				);
			}
		}
	}

	if (dryRun) {
		progress?.('Dry-run : simulation dédup stricte…');
		const { removed } = await dedupeStrictDuplicateTranslations({ dryRun: true });
		dedupedTranslations = removed;
		progress?.(`Dry-run : ${removed} doublon(s) seraient fusionné(s)`);
	}

	progress?.(
		`Résumé import : +${insertedGames} jeu(x), ${updatedGames} maj jeu(x), +${insertedTranslations} trad., ${updatedTranslations} maj trad.`
	);

	return {
		total: games.length,
		insertedGames,
		updatedGames,
		insertedTranslations,
		updatedTranslations,
		deletedTranslations,
		dedupedTranslations,
		createdTranslators,
		createdProofreaders,
		skipped,
		jeuxSheetTouchIds: dryRun ? [] : [...jeuxSheetTouchIds]
	};
};

const syncAllDbToSpreadsheet = async (
	onProgress?: (message: string) => void,
	opts?: Parameters<typeof syncDbToSpreadsheetBulk>[1]
) => {
	return syncDbToSpreadsheetBulk(onProgress, opts ?? {});
};

type LegacySyncMilestone = { atMs: number; message: string };

export const load: PageServerLoad = async ({ locals }) => {
	// Vérifier que l'utilisateur est admin
	if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
		throw new Error('Accès non autorisé');
	}

	let configRow;
	try {
		const configResult = await db
			.select()
			.from(table.config)
			.where(eq(table.config.id, 'main'))
			.limit(1);

		configRow = configResult[0] || null;
	} catch (error: unknown) {
		console.warn('Erreur lors du chargement de la configuration:', error);
		configRow = null;
	}

	const effective = configRow ? getEffectiveConfigFromRow(configRow) : await getEffectiveConfig();
	const config = configRow ? toConfigClientSafe(configRow) : null;
	const webhookStatus = {
		updates: Boolean(effective?.discordWebhookUpdates?.trim()),
		translators: Boolean(effective?.discordWebhookTranslators?.trim()),
		admin: Boolean(effective?.discordWebhookProofreaders?.trim())
	};

	return {
		config,
		webhookStatus
	};
};

export const actions: Actions = {
	triggerAutoCheck: async ({ locals }) => {
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return { success: false, message: 'Accès non autorisé', details: null };
		}

		try {
			const result = await runAutoCheckVersions();
			await db
				.update(table.config)
				.set({
					autoCheckLastRunAt: new Date(),
					updatedAt: new Date()
				})
				.where(eq(table.config.id, 'main'));

			return {
				success: true,
				message: `Auto-check lancé: ${result.updatedGames} jeu(x) mis à jour`,
				details: result
			};
		} catch (error: unknown) {
			return {
				success: false,
				message: "Erreur lors de l'exécution de l'auto-check",
				details: error instanceof Error ? error.message : 'Erreur inconnue'
			};
		}
	},
	testGoogleSheets: async ({ request, locals }) => {
		// Vérifier que l'utilisateur est admin
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return {
				success: false,
				message: 'Accès non autorisé',
				details: null
			};
		}

		const formData = await request.formData();
		const spreadsheetId = (formData.get('spreadsheetId') as string)?.trim();

		if (!spreadsheetId) {
			return {
				success: false,
				message: "L'ID du spreadsheet est requis",
				details: null
			};
		}

		try {
			const merged = await getEffectiveConfig();
			const apiKey = merged?.googleApiKey;

			// Essayer d'obtenir un token OAuth2 valide
			const oauthToken = await getValidAccessToken();

			// Tester la connexion avec l'API Google Sheets
			// On utilise l'API REST directement pour tester l'accès
			let apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`;

			const headers: HeadersInit = {
				Accept: 'application/json'
			};

			// Utiliser OAuth2 si disponible, sinon utiliser la clé API
			if (oauthToken) {
				headers['Authorization'] = `Bearer ${oauthToken}`;
			} else if (apiKey) {
				apiUrl += `&key=${encodeURIComponent(apiKey)}`;
			}

			const response = await fetch(apiUrl, {
				method: 'GET',
				headers
			});

			// Si la réponse n'est pas OK, essayer de parser l'erreur
			if (!response.ok) {
				let errorData;
				try {
					errorData = await response.json();
				} catch {
					errorData = { error: { message: `Erreur HTTP ${response.status}` } };
				}

				if (response.status === 404) {
					return {
						success: false,
						message: 'Spreadsheet introuvable',
						details: "L'ID du spreadsheet est incorrect ou le spreadsheet n'existe pas."
					};
				}

				if (response.status === 403) {
					if (!oauthToken && !apiKey) {
						return {
							success: false,
							message: 'Authentification requise',
							details:
								"Une clé API Google ou une authentification OAuth2 est nécessaire pour accéder aux spreadsheets via l'API. Veuillez configurer l'une des deux méthodes dans les paramètres."
						};
					}
					return {
						success: false,
						message: 'Accès refusé',
						details: oauthToken
							? "Le spreadsheet n'est pas accessible avec ce compte OAuth2. Vérifiez que le compte a les permissions nécessaires."
							: "Le spreadsheet n'est pas accessible avec cette clé API. Vérifiez que la clé API est correcte et que le spreadsheet est partagé correctement."
					};
				}

				if (response.status === 401) {
					return {
						success: false,
						message: 'Clé API invalide',
						details:
							'La clé API configurée est invalide ou a expiré. Veuillez vérifier votre clé API dans les paramètres.'
					};
				}

				return {
					success: false,
					message: `Erreur API: ${response.status}`,
					details: errorData.error?.message || "Erreur lors de la connexion à l'API Google Sheets"
				};
			}

			const data = await response.json();

			return {
				success: true,
				message: 'Connexion réussie !',
				details: {
					title: data.properties?.title || 'Sans titre',
					sheets:
						data.sheets?.map(
							(sheet: { properties: { title: string } }) => sheet.properties.title
						) || [],
					spreadsheetId
				}
			};
		} catch (error: unknown) {
			console.error('Erreur lors du test de connexion Google Sheets:', error);

			const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';

			return {
				success: false,
				message: 'Erreur lors de la connexion',
				details: errorMessage
			};
		}
	},
	testScrape: async ({ request, locals }) => {
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return {
				success: false,
				message: 'Accès non autorisé',
				details: null
			};
		}

		const formData = await request.formData();
		const threadIdRaw = formData.get('threadId');
		const website = (formData.get('website') as 'f95z' | 'lc' | 'other' | null) ?? null;

		const threadId = typeof threadIdRaw === 'string' ? Number.parseInt(threadIdRaw, 10) : null;

		if (!threadId || Number.isNaN(threadId)) {
			return {
				success: false,
				message: "L'ID du thread est requis",
				details: null
			};
		}

		if (!website || website !== 'f95z') {
			return {
				success: false,
				message: 'Le scraping de test ne supporte actuellement que les threads F95',
				details: null
			};
		}

		try {
			const data = await scrapeF95Thread(threadId);
			return {
				success: true,
				message: 'Scrape réussi',
				details: data
			};
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
			return {
				success: false,
				message: 'Erreur lors du scraping',
				details: errorMessage
			};
		}
	},
	importLegacyGamesJson: async ({ request, locals }) => {
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return {
				success: false,
				message: 'Accès non autorisé',
				details: null
			};
		}

		const formData = await request.formData();
		const payload = String(formData.get('legacyJson') ?? '').trim();

		if (!payload) {
			return {
				success: false,
				message: 'JSON requis',
				details: 'Collez un JSON contenant un tableau "games".'
			};
		}

		try {
			const parsed = JSON.parse(payload) as unknown;
			const games = parseLegacyGames(parsed);

			if (!games || games.length === 0) {
				return {
					success: false,
					message: 'Aucun jeu trouvé',
					details: 'Le JSON doit être un tableau ou contenir { "games": [...] }.'
				};
			}

			return {
				success: true,
				message: 'Import terminé',
				details: await upsertLegacyGames(games)
			};
		} catch (error: unknown) {
			return {
				success: false,
				message: "Erreur lors de l'import",
				details: error instanceof Error ? error.message : 'Erreur inconnue'
			};
		}
	},
	syncLegacyApiTranslators: async ({ request, locals }) => {
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return { success: false, message: 'Accès non autorisé', details: null };
		}

		await request.formData();

		try {
			const response = await fetchLegacyApiGet();
			if (!response.ok) {
				return { success: false, message: `Erreur API: ${response.status}`, details: null };
			}

			const payload = (await response.json()) as unknown;
			const translators = parseLegacyTranslators(payload);
			if (!translators || translators.length === 0) {
				return { success: false, message: 'Aucun traducteur dans data.traductors', details: null };
			}

			const details = await upsertLegacyTranslators(translators);
			return {
				success: true,
				message: 'Synchronisation traducteurs terminée',
				details
			};
		} catch (error: unknown) {
			return {
				success: false,
				message: 'Erreur pendant la synchronisation des traducteurs',
				details: error instanceof Error ? error.message : 'Erreur inconnue'
			};
		}
	},
	checkLegacyApiGames: async ({ request, locals }) => {
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return { success: false, message: 'Accès non autorisé', details: null };
		}
		await request.formData();

		try {
			const response = await fetchLegacyApiGet();
			if (!response.ok) {
				return { success: false, message: `Erreur API: ${response.status}`, details: null };
			}
			const payload = (await response.json()) as {
				data?: { games?: LegacyGame[]; traductors?: unknown[] };
			};
			const games = payload?.data?.games ?? [];
			const translators = parseLegacyTranslators(payload) ?? [];

			if (!Array.isArray(games) && translators.length === 0) {
				return { success: false, message: 'Aucune donnée legacy exploitable', details: null };
			}

			const [gamesPreview, translatorsPreview] = await Promise.all([
				Array.isArray(games) ? upsertLegacyGames(games, { dryRun: true }) : null,
				translators.length > 0 ? upsertLegacyTranslators(translators, { dryRun: true }) : null
			]);

			return {
				success: true,
				message: 'Vérification terminée (aperçu synchronisation)',
				details: {
					games:
						gamesPreview ??
						({
							total: 0,
							insertedGames: 0,
							updatedGames: 0,
							insertedTranslations: 0,
							updatedTranslations: 0,
							deletedTranslations: 0,
							dedupedTranslations: 0,
							createdTranslators: 0,
							createdProofreaders: 0,
							skipped: 0
						} as const),
					translators:
						translatorsPreview ??
						({
							total: 0,
							inserted: 0,
							updated: 0,
							skipped: 0
						} as const)
				}
			};
		} catch (error: unknown) {
			return {
				success: false,
				message: 'Erreur pendant la comparaison API',
				details: error instanceof Error ? error.message : 'Erreur inconnue'
			};
		}
	},
	syncLegacyApiGames: async ({ request, locals }) => {
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return { success: false, message: 'Accès non autorisé', details: null };
		}

		await request.formData();

		const t0 = Date.now();
		const milestones: LegacySyncMilestone[] = [];
		const progress = (message: string) => {
			const atMs = Date.now() - t0;
			milestones.push({ atMs, message });
			console.log(`[legacy-sync] +${atMs}ms ${message}`);
		};

		try {
			progress('Démarrage : API legacy → DB → Google Sheets');
			progress(
				`Requête HTTP GET vers l’API legacy (timeout ${LEGACY_FETCH_TIMEOUT_MS / 1000}s, jusqu’à ${1 + LEGACY_FETCH_RETRIES} tentative(s))…`
			);
			const response = await fetchLegacyApiGet(progress);
			if (!response.ok) {
				progress(`Échec HTTP : ${response.status}`);
				return {
					success: false,
					message: `Erreur API: ${response.status}`,
					details: { milestones }
				};
			}

			progress(`Réponse HTTP ${response.status}, lecture et parsing JSON…`);
			const payload = (await response.json()) as { data?: { games?: LegacyGame[] } };
			const games = payload?.data?.games ?? [];
			if (!Array.isArray(games) || games.length === 0) {
				progress('Payload sans jeux exploitables (data.games vide ou absent)');
				return {
					success: false,
					message: 'Aucun game dans data.games',
					details: { milestones }
				};
			}

			progress(`${games.length} jeu(x) dans le payload, upsert base de données…`);
			const details = await upsertLegacyGames(games, { progress });
			const touch = details.jeuxSheetTouchIds;
			const skipJeuxWrites = touch.length === 0;
			if (skipJeuxWrites) {
				progress(
					'Upsert DB terminé : aucune ligne Jeux à mettre à jour (purge orphelins + TR si besoin)…'
				);
			} else {
				progress(
					`Upsert DB terminé : push partiel vers Sheets (${touch.length} traduction(s) touchée(s))…`
				);
			}
			const spreadsheetSync = await syncAllDbToSpreadsheet(progress, {
				onlyJeuxTranslationIds: skipJeuxWrites ? undefined : new Set(touch),
				skipJeuxRowWrites: skipJeuxWrites,
				skipTranslatorTab: details.createdTranslators === 0 && details.createdProofreaders === 0
			});
			progress(
				spreadsheetSync.errors.length === 0
					? 'Terminé : aucune erreur Sheets signalée'
					: `Terminé : ${spreadsheetSync.errors.length} erreur(s) Sheets (voir details.spreadsheetSync.errors)`
			);

			return {
				success: spreadsheetSync.errors.length === 0,
				message:
					spreadsheetSync.errors.length === 0
						? 'Synchronisation API terminee'
						: 'Synchronisation API terminee (avec erreurs Spreadsheet)',
				details: {
					legacy: details,
					milestones,
					spreadsheetSync
				}
			};
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : 'Erreur inconnue';
			progress(`Erreur : ${msg}`);
			return {
				success: false,
				message: 'Erreur pendant la synchronisation API',
				details: { error: msg, milestones }
			};
		}
	},
	cleanupDuplicateTranslations: async ({ locals }) => {
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return { success: false, message: 'Accès non autorisé', details: null };
		}

		try {
			const before = (await db.execute(
				sql`select count(*)::int as count from game_translation`
			)) as unknown as Array<{
				count: number;
			}>;
			const beforeCount = before[0]?.count ?? 0;

			const { removed, duplicateIds } = await dedupeStrictDuplicateTranslations();
			if (duplicateIds.length === 0) {
				return {
					success: true,
					message: 'Aucun doublon (même jeu + version + lien) à nettoyer',
					details: { before: beforeCount, after: beforeCount, removed: 0 }
				};
			}

			try {
				await deleteGameTranslationsFromGoogleSheet(duplicateIds);
			} catch (err) {
				console.warn('cleanupDuplicateTranslations: sheet', err);
			}

			const afterCount = beforeCount - removed;

			return {
				success: true,
				message: 'Doublons stricts nettoyés',
				details: {
					before: beforeCount,
					after: afterCount,
					removed
				}
			};
		} catch (error: unknown) {
			return {
				success: false,
				message: 'Erreur pendant le nettoyage des doublons',
				details: error instanceof Error ? error.message : 'Erreur inconnue'
			};
		}
	},
	clearAllTranslationNames: async ({ request, locals }) => {
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return { success: false, message: 'Accès non autorisé', details: null };
		}

		await request.formData();

		try {
			const updated = await db
				.update(table.gameTranslation)
				.set({
					translationName: null,
					updatedAt: new Date()
				})
				.where(sql`${table.gameTranslation.translationName} is not null`)
				.returning({ id: table.gameTranslation.id });

			return {
				success: true,
				message: 'Nom de traduction vidé pour toutes les traductions',
				details: { updated: updated.length }
			};
		} catch (error: unknown) {
			return {
				success: false,
				message: 'Erreur pendant la suppression des noms de traduction',
				details: error instanceof Error ? error.message : 'Erreur inconnue'
			};
		}
	},
	syncDbToSpreadsheet: async ({ request, locals }) => {
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return { success: false, message: 'Accès non autorisé', details: null };
		}

		await request.formData();

		try {
			const result = await syncAllDbToSpreadsheet();

			return {
				success: result.errors.length === 0,
				message:
					result.errors.length === 0
						? 'Synchronisation DB -> Spreadsheet terminée'
						: 'Synchronisation terminée avec erreurs',
				details: result
			};
		} catch (error: unknown) {
			return {
				success: false,
				message: 'Erreur pendant la synchronisation globale',
				details: error instanceof Error ? error.message : 'Erreur inconnue'
			};
		}
	},
	testDiscordWebhook: async ({ request, locals }) => {
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return {
				success: false,
				message: 'Accès non autorisé',
				details: null,
				channel: null,
				httpStatus: null as number | null
			};
		}

		const formData = await request.formData();
		const raw = formData.get('channel');
		const channel = raw === 'updates' || raw === 'translators' || raw === 'admin' ? raw : null;

		if (!channel) {
			return {
				success: false,
				message: 'Canal invalide',
				details: null,
				channel: null,
				httpStatus: null
			};
		}

		const cfg = await getEffectiveConfig();
		const urlByChannel = {
			updates: cfg?.discordWebhookUpdates,
			translators: cfg?.discordWebhookTranslators,
			admin: cfg?.discordWebhookProofreaders
		} as const;

		const url = urlByChannel[channel]?.trim();
		if (!url) {
			return {
				success: false,
				message: 'Aucune URL enregistrée pour ce canal (paramètres).',
				details: null,
				channel,
				httpStatus: null
			};
		}

		const labels: Record<typeof channel, string> = {
			updates: 'Mises à jour',
			translators: 'Traducteurs',
			admin: 'Admin'
		};

		const payload = {
			content: '',
			tts: false,
			embeds: [
				{
					title: 'Test webhook — F95 France',
					description: `Canal **${labels[channel]}** : la configuration est joignable depuis l’outil dev.`,
					color: 0x5865f2,
					footer: {
						text: `Dev · ${new Date().toISOString()}`
					}
				}
			]
		};

		try {
			const res = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
				signal: AbortSignal.timeout(15_000)
			});

			const bodyText = await res.text().catch(() => '');
			if (!res.ok) {
				return {
					success: false,
					message: `Discord a répondu ${res.status}`,
					details: bodyText ? bodyText.slice(0, 600) : 'Corps de réponse vide',
					channel,
					httpStatus: res.status
				};
			}

			return {
				success: true,
				message: `Message de test envoyé (${labels[channel]}).`,
				details: null,
				channel,
				httpStatus: res.status
			};
		} catch (error: unknown) {
			const msg = error instanceof Error ? error.message : 'Erreur inconnue';
			return {
				success: false,
				message: 'Échec de la requête vers Discord',
				details: msg,
				channel,
				httpStatus: null
			};
		}
	}
};
