import { getEffectiveConfig } from '$lib/server/app-config';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { gameAutoCheckEnabledForWebsite } from '$lib/server/game-auto-check';
import { getValidAccessToken } from '$lib/server/google-oauth';
import { and, count, eq, inArray, sql } from 'drizzle-orm';

const SHEET_TAB_JEUX = 'Jeux';
const SHEET_TAB_TR = 'Traducteurs/Relecteurs';
const SHEET_TAB_MAJ = 'MAJ';

type SheetsApiResponse = {
	values?: string[][];
};

type SheetMetaResponse = {
	sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
};

function normalizeHeader(raw: string): string {
	return raw
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function findHeaderIndex(headersRow: string[], candidates: string[]): number {
	const normalizedHeaders = headersRow.map((h) => normalizeHeader(h ?? ''));
	const normalizedCandidates = candidates.map((c) => normalizeHeader(c));

	// 1) Match exact (le plus fiable)
	for (const cand of normalizedCandidates) {
		const i = normalizedHeaders.findIndex((h) => h === cand);
		if (i !== -1) return i;
	}

	// 2) Match inclusif (tolérant aux variantes: parenthèses, suffixes, etc.)
	for (const cand of normalizedCandidates) {
		const i = normalizedHeaders.findIndex((h) => h.includes(cand) || cand.includes(h));
		if (i !== -1) return i;
	}

	return -1;
}

function findHeaderIndexByTokens(
	headersRow: string[],
	requiredTokens: string[],
	optionalTokens: string[] = []
): number {
	const normalizedHeaders = headersRow.map((h) => normalizeHeader(h ?? ''));
	const req = requiredTokens.map((t) => normalizeHeader(t));
	const opt = optionalTokens.map((t) => normalizeHeader(t));

	let bestIdx = -1;
	let bestScore = -1;
	for (let i = 0; i < normalizedHeaders.length; i++) {
		const h = normalizedHeaders[i];
		const hasAllRequired = req.every((t) => h.includes(t));
		if (!hasAllRequired) continue;
		const optionalScore = opt.reduce((acc, t) => acc + (h.includes(t) ? 1 : 0), 0);
		if (optionalScore > bestScore) {
			bestScore = optionalScore;
			bestIdx = i;
		}
	}
	return bestIdx;
}

function toColA1(colIndex: number): string {
	let n = colIndex + 1;
	let out = '';
	while (n > 0) {
		const rem = (n - 1) % 26;
		out = String.fromCharCode(65 + rem) + out;
		n = Math.floor((n - 1) / 26);
	}
	return out;
}

function escapeFormulaText(v: string): string {
	return v.replaceAll('"', '""');
}

function asHyperlink(url: string | null | undefined, label: string): string {
	const safeLabel = escapeFormulaText(label);
	if (!url || !url.trim()) return safeLabel;
	const safeUrl = escapeFormulaText(url.trim());
	// Séparateur ';' : cohérent avec un classeur Google en locale FR (comme saisie utilisateur).
	return `=HYPERLINK("${safeUrl}"; "${safeLabel}")`;
}

/** URL du fil du jeu : champ `link`, ou dérivée de `threadId` + site (comme dans le formulaire dashboard). */
function gameSpreadsheetLink(game: typeof table.game.$inferSelect): string | null {
	const direct = (game.link ?? '').trim();
	if (direct) return direct;
	const tid = game.threadId;
	if (tid == null || tid === 0) return null;
	switch ((game.website ?? '').trim().toLowerCase()) {
		case 'f95z':
			return `https://f95zone.to/threads/${tid}`;
		case 'lc':
			return `https://lewcorner.com/threads/${tid}`;
		default:
			return null;
	}
}

function formatWebsite(v: string | null | undefined): string {
	switch ((v ?? '').trim().toLowerCase()) {
		case 'f95z':
			return 'F95z';
		case 'lc':
			return 'LewdCorner';
		default:
			return 'Autre';
	}
}

function formatStatus(v: string | null | undefined): string {
	switch ((v ?? '').trim().toLowerCase()) {
		case 'in_progress':
			return 'EN COURS';
		case 'completed':
			return 'TERMINÉ';
		case 'abandoned':
			return 'ABANDONNÉ';
		default:
			return (v ?? '').trim().toUpperCase();
	}
}

function formatGameType(v: string | null | undefined): string {
	switch ((v ?? '').trim().toLowerCase()) {
		case 'renpy':
			return 'RenPy';
		case 'rpgm':
			return 'RPGM';
		case 'unity':
			return 'Unity';
		case 'unreal':
			return 'Unreal';
		case 'flash':
			return 'Flash';
		case 'html':
		case 'htlm':
			return 'HTML';
		case 'qsp':
			return 'QSP';
		default:
			return 'Autre';
	}
}

function formatTranslationKind(v: string | null | undefined): string {
	switch ((v ?? '').trim().toLowerCase()) {
		case 'translation':
			return 'Traduction';
		case 'translation_with_mods':
			return 'Traduction (mod inclus)';
		case 'no_translation':
			return 'Pas de traduction';
		case 'integrated':
			return 'Intégrée';
		default:
			return 'Traduction';
	}
}

/** Libellé du lien « Lien Trad » : évite le texte générique « Traduction » partout (exports CSV / unicité). */
function lienTradDisplayLabel(
	game: typeof table.game.$inferSelect,
	tr: typeof table.gameTranslation.$inferSelect
): string {
	void game;
	return formatTranslationKind(tr.tname);
}

/**
 * Libellé « Nom du jeu » dans la feuille : **nom du jeu**, **tiret** (`-`), **nom de traduction**
 * (édition spéciale, DLC, etc.). Espaces autour du tiret pour la lisibilité en tableur.
 */
function formatJeuxNomAffiche(
	gameName: string,
	translationName: string | null | undefined
): string {
	const g = (gameName ?? '').trim();
	let t = (translationName ?? '').trim();
	t = t.replace(/^[\s\-–—:]+/, '');
	if (!t) return g;
	if (!g) return t;
	return `${g} - ${t}`;
}

type JeuxRowInput = {
	tr: typeof table.gameTranslation.$inferSelect;
	game: typeof table.game.$inferSelect;
	translator: typeof table.translator.$inferSelect | null;
	proofreader: typeof table.translator.$inferSelect | null;
};

/** Remplit une ligne « Jeux » selon les en-têtes du spreadsheet (sync unitaire + bulk). */
function populateJeuxRowValues(
	headersRow: string[],
	rowValues: string[],
	input: JeuxRowInput
): void {
	const { tr, game, translator, proofreader } = input;
	const set = (headers: string | string[], value: string) => {
		const i = findHeaderIndex(headersRow, Array.isArray(headers) ? headers : [headers]);
		if (i !== -1) rowValues[i] = value;
	};

	const nomAffiche = formatJeuxNomAffiche(game.name ?? '', tr.translationName);
	const lienLabel = lienTradDisplayLabel(game, tr);

	set('Site', formatWebsite(game.website));
	set(['Nom du jeu', 'Jeu'], asHyperlink(gameSpreadsheetLink(game), nomAffiche));
	set('Version', sheetLiteralVersionText(getJeuxGameVersionValue(tr, game)));
	set(
		['Trad. Ver.', 'Trad Ver', 'Trad. Ver', 'TRAD. VER.', 'Version trad', 'Version traduction'],
		sheetLiteralVersionText(getTradVerValue(tr, game))
	);
	set(['Lien Trad', 'Lien traduction'], asHyperlink(tr.tlink, lienLabel));
	set(['Status', 'Statut'], formatStatus(tr.status));
	set('Tags', game.tags ?? '');
	set('Type', formatGameType(tr.gameType));
	const translatorLabel = translator?.name ?? '';
	set(
		['Traducteur', 'Traducteurs', 'TRADUCTEUR', 'TRADUCTEURS'],
		translatorLabel ? asHyperlink(firstPageLink(translator?.pages), translatorLabel) : ''
	);
	const proofreaderLabel = proofreader?.name ?? '';
	set(
		['Relecteur', 'Relecteurs', 'RELECTEUR', 'RELECTEURS'],
		proofreaderLabel ? asHyperlink(firstPageLink(proofreader?.pages), proofreaderLabel) : ''
	);
	set(['Type de traduction', 'Type traduction'], formatTranslationType(tr.ttype));
	set(['AC', 'Auto-Check', 'Auto check', 'AUTO CHECK'], tr.ac ? 'Oui' : 'Non');
	set(['IMAGE', 'Image', 'Image URL', 'Image url'], game.image ?? '');
	const tid = game.threadId;
	set(
		[
			'THREAD',
			'THREAD ID',
			'Thread ID',
			'ID THREAD',
			'FIL',
			'Id fil',
			'ID fil',
			'N° fil',
			'ID FIL'
		],
		tid != null && tid !== 0 ? String(tid) : ''
	);
	set(['ID DB', 'Id Db'], tr.id);

	const tradVerIdx =
		findHeaderIndex(headersRow, [
			'Trad. Ver.',
			'TRAD. VER.',
			'Trad Ver',
			'Version trad',
			'Version traduction'
		]) !== -1
			? findHeaderIndex(headersRow, [
					'Trad. Ver.',
					'TRAD. VER.',
					'Trad Ver',
					'Version trad',
					'Version traduction'
				])
			: findHeaderIndexByTokens(headersRow, ['trad'], ['ver', 'version']);
	if (tradVerIdx !== -1) rowValues[tradVerIdx] = sheetLiteralVersionText(getTradVerValue(tr, game));

	const idDbIdx =
		findHeaderIndex(headersRow, ['ID DB', 'Id Db']) !== -1
			? findHeaderIndex(headersRow, ['ID DB', 'Id Db'])
			: findHeaderIndexByTokens(headersRow, ['id'], ['db']);
	if (idDbIdx !== -1) rowValues[idDbIdx] = tr.id;
}

function formatTranslationType(v: string | null | undefined): string {
	switch ((v ?? '').trim().toLowerCase()) {
		case 'vf':
			return 'VO Française';
		case 'manual':
			return 'Traduction Humaine';
		case 'semi-auto':
			return 'Traduction Semi-Automatique';
		case 'auto':
			return 'Traduction Automatique';
		case 'to_tested':
			return 'À tester';
		case 'hs':
			return 'Lien Trad HS';
		default:
			return (v ?? '').trim();
	}
}

/** Version du jeu affichée sur la ligne « Jeux » : par traduction si renseignée, sinon version courante du jeu. */
function getJeuxGameVersionValue(
	tr: typeof table.gameTranslation.$inferSelect,
	game: typeof table.game.$inferSelect
): string {
	const rowVersion = typeof tr.version === 'string' ? tr.version.trim() : (tr.version ?? '');
	return rowVersion || (game.gameVersion ?? '');
}

function getTradVerValue(
	tr: typeof table.gameTranslation.$inferSelect,
	game: typeof table.game.$inferSelect
): string {
	const translationVersion =
		typeof tr.tversion === 'string' ? tr.tversion.trim() : (tr.tversion ?? '');
	return translationVersion || (game.gameVersion ?? '');
}

/**
 * Avec `USER_ENTERED`, Sheets peut interpréter une version (ex. `1.0`, `12-1`, `3/10`) comme nombre ou date.
 * Le préfixe `'` force le texte (comportement identique à une saisie manuelle ; l’apostrophe ne s’affiche pas).
 */
function sheetLiteralVersionText(value: string): string {
	const v = (value ?? '').trim();
	if (!v) return '';
	if (v.startsWith("'")) return v;
	if (v.startsWith('=')) return v;
	return `'${v}`;
}

function parsePages(pagesRaw: string | null | undefined): Array<{ name?: string; link?: string }> {
	if (!pagesRaw || !pagesRaw.trim()) return [];
	try {
		const parsed = JSON.parse(pagesRaw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((p) => p && typeof p === 'object') as Array<{
			name?: string;
			link?: string;
		}>;
	} catch {
		return [];
	}
}

function pagesToFormula(pagesRaw: string | null | undefined): string {
	const pages = parsePages(pagesRaw)
		.map((p) => ({
			name: (p.name ?? '').trim(),
			link: (p.link ?? '').trim()
		}))
		.filter((p) => p.name || p.link);
	if (pages.length === 0) return '';

	// Équivalent "texte avec lien" via formules Sheets.
	const items = pages.map((p) => {
		const label = p.name || p.link;
		if (!p.link) return `"${escapeFormulaText(label)}"`;
		return `HYPERLINK("${escapeFormulaText(p.link)}"; "${escapeFormulaText(label)}")`;
	});
	if (items.length === 1) return `=${items[0]}`;
	return `=TEXTJOIN(CHAR(10); TRUE; ${items.join('; ')})`;
}

function firstPageLink(pagesRaw: string | null | undefined): string | null {
	const pages = parsePages(pagesRaw)
		.map((p) => ({
			name: (p.name ?? '').trim(),
			link: (p.link ?? '').trim()
		}))
		.filter((p) => p.name || p.link);
	const first = pages[0];
	if (!first?.link) return null;
	return first.link;
}

async function getSheetsAuth(): Promise<{
	spreadsheetId: string;
	headers: HeadersInit;
	apiKey?: string;
} | null> {
	const cfg = await getEffectiveConfig();
	const spreadsheetId = cfg?.googleSpreadsheetId?.trim();
	if (!spreadsheetId) return null;

	const oauthToken = await getValidAccessToken();
	const headers: HeadersInit = { Accept: 'application/json' };
	if (oauthToken) {
		headers['Authorization'] = `Bearer ${oauthToken}`;
		return { spreadsheetId, headers };
	}

	const apiKey = cfg?.googleApiKey?.trim();
	if (!apiKey) return null;
	return { spreadsheetId, headers, apiKey };
}

async function sheetsFetch(
	spreadsheetId: string,
	headers: HeadersInit,
	path: string,
	apiKey?: string,
	init: RequestInit = {}
): Promise<Response> {
	const base = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
	const sep = path.includes('?') ? '&' : '?';
	const url = apiKey ? `${base}${path}${sep}key=${encodeURIComponent(apiKey)}` : `${base}${path}`;
	const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
	const maxAttempts = 4;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const res = await fetch(url, {
			...init,
			headers: {
				...headers,
				...(init.headers ?? {})
			}
		});

		const shouldRetry = res.status === 429 || res.status >= 500;
		if (!shouldRetry || attempt === maxAttempts) return res;

		const retryAfter = Number.parseInt(res.headers.get('retry-after') ?? '', 10);
		const backoffMs = Number.isFinite(retryAfter)
			? Math.max(1000, retryAfter * 1000)
			: 1200 * 2 ** (attempt - 1);
		await sleep(backoffMs);
	}

	// Inatteignable, garde-fou TypeScript.
	return fetch(url, {
		...init,
		headers: {
			...headers,
			...(init.headers ?? {})
		}
	});
}

async function sheetsBatchUpdate(
	auth: { spreadsheetId: string; headers: HeadersInit; apiKey?: string },
	data: Array<{ range: string; values: string[][] }>
): Promise<void> {
	if (data.length === 0) return;
	const res = await sheetsFetch(
		auth.spreadsheetId,
		auth.headers,
		`/values:batchUpdate`,
		auth.apiKey,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				valueInputOption: 'USER_ENTERED',
				data
			})
		}
	);
	if (!res.ok) {
		const err = await res.text().catch(() => '');
		throw new Error(`Sheets batchUpdate error (${res.status}): ${err.slice(0, 500)}`);
	}
}

type SheetSnapshot = {
	tabEncoded: string;
	tabA1: string;
	headersRow: string[];
	idDbIdx: number;
	lastCol: string;
	rowNumberById: Map<string, number>;
	/** Présent si `includeDataRows` a été demandé à la lecture (lignes brutes API, y compris l’en-tête). */
	dataRows?: string[][];
};

const TRANSLATION_ID_DB_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Interprète la cellule AC exportée / saisie (Oui/Non, bool Sheets, etc.). `null` = laisser la base inchangée. */
function parseJeuxSheetAcCell(raw: unknown): boolean | null {
	if (raw === true || raw === 1) return true;
	if (raw === false || raw === 0) return false;
	if (raw == null) return null;
	const s = String(raw).trim();
	if (!s) return null;
	const lower = s.toLowerCase();
	if (['oui', 'yes', 'true', '1', 'vrai', 'o', 'y'].includes(lower)) return true;
	if (['non', 'no', 'false', '0', 'faux', 'n'].includes(lower)) return false;
	return null;
}

/**
 * Applique la colonne AC de l’onglet Jeux vers la base (avant l’écriture DB→Sheets).
 * Met à jour `game_translation.ac` et recalcule `game.game_auto_check` pour les jeux concernés.
 */
async function applyAcColumnFromJeuxSheetToDb(
	headersRow: string[],
	dataRows: string[][],
	onProgress?: (message: string) => void
): Promise<void> {
	const idDbIdx =
		findHeaderIndex(headersRow, ['ID DB', 'Id Db']) !== -1
			? findHeaderIndex(headersRow, ['ID DB', 'Id Db'])
			: findHeaderIndexByTokens(headersRow, ['id'], ['db']);
	if (idDbIdx === -1) return;

	const acIdx = findHeaderIndex(headersRow, ['AC', 'Auto-Check', 'Auto check', 'AUTO CHECK']);
	if (acIdx === -1) {
		onProgress?.('Sheets Jeux : colonne AC introuvable — pas de synchro feuille→base pour AC');
		return;
	}

	const acByTranslationId = new Map<string, boolean>();
	for (let i = 1; i < dataRows.length; i++) {
		const row = dataRows[i] ?? [];
		const idVal = String(row[idDbIdx] ?? '').trim();
		if (!idVal || !TRANSLATION_ID_DB_RE.test(idVal)) continue;
		const acParsed = parseJeuxSheetAcCell(row[acIdx]);
		if (acParsed === null) continue;
		acByTranslationId.set(idVal, acParsed);
	}
	if (acByTranslationId.size === 0) return;

	const ids = [...acByTranslationId.keys()];
	const existing = await db
		.select({
			id: table.gameTranslation.id,
			gameId: table.gameTranslation.gameId,
			ac: table.gameTranslation.ac
		})
		.from(table.gameTranslation)
		.where(inArray(table.gameTranslation.id, ids));

	const existingById = new Map(existing.map((e) => [e.id, e]));
	const gameIdsToReconcile = new Set<string>();
	for (const id of acByTranslationId.keys()) {
		const row = existingById.get(id);
		if (row) gameIdsToReconcile.add(row.gameId);
	}
	if (gameIdsToReconcile.size === 0) return;

	const finalUpdates: Array<{ id: string; ac: boolean; gameId: string }> = [];
	for (const [id, ac] of acByTranslationId) {
		const row = existingById.get(id);
		if (!row || row.ac === ac) continue;
		finalUpdates.push({ id, ac, gameId: row.gameId });
	}

	if (finalUpdates.length > 0) {
		onProgress?.(`Sheets Jeux : AC feuille→base (${finalUpdates.length} traduction(s))…`);
		const UPD_CONCURRENCY = 40;
		for (let i = 0; i < finalUpdates.length; i += UPD_CONCURRENCY) {
			const chunk = finalUpdates.slice(i, i + UPD_CONCURRENCY);
			await Promise.all(
				chunk.map((u) =>
					db
						.update(table.gameTranslation)
						.set({ ac: u.ac, updatedAt: new Date() })
						.where(eq(table.gameTranslation.id, u.id))
				)
			);
		}
	} else {
		onProgress?.(
			'Sheets Jeux : traductions AC déjà alignées — recalcul gameAutoCheck pour les jeux concernés…'
		);
	}

	const UPD_CONCURRENCY = 40;
	const gameIds = [...gameIdsToReconcile];
	for (let i = 0; i < gameIds.length; i += UPD_CONCURRENCY) {
		const chunk = gameIds.slice(i, i + UPD_CONCURRENCY);
		await Promise.all(
			chunk.map(async (gameId) => {
				const [g] = await db
					.select({ website: table.game.website })
					.from(table.game)
					.where(eq(table.game.id, gameId))
					.limit(1);
				if (!g) return;
				const [row] = await db
					.select({ n: count() })
					.from(table.gameTranslation)
					.where(and(eq(table.gameTranslation.gameId, gameId), eq(table.gameTranslation.ac, true)));
				const hasAc = (row?.n ?? 0) > 0;
				const gameAutoCheck = gameAutoCheckEnabledForWebsite(g.website ?? '') && hasAc;
				await db
					.update(table.game)
					.set({ gameAutoCheck, updatedAt: new Date() })
					.where(eq(table.game.id, gameId));
			})
		);
	}
}

async function getSheetSnapshot(
	auth: { spreadsheetId: string; headers: HeadersInit; apiKey?: string },
	tabName: string,
	options?: { includeDataRows?: boolean }
): Promise<SheetSnapshot> {
	const tabEncoded = encodeURIComponent(tabName);
	const getAllRes = await sheetsFetch(
		auth.spreadsheetId,
		auth.headers,
		`/values/${tabEncoded}!A1:ZZ?majorDimension=ROWS`,
		auth.apiKey
	);
	if (!getAllRes.ok) {
		const err = await getAllRes.text().catch(() => '');
		throw new Error(`Sheets read error (${getAllRes.status}): ${err.slice(0, 500)}`);
	}
	const body = (await getAllRes.json()) as SheetsApiResponse;
	const rows = body.values ?? [];
	if (rows.length === 0) throw new Error(`La feuille "${tabName}" est vide (en-têtes manquants).`);

	const headersRow = rows[0] ?? [];
	const idDbIdx =
		findHeaderIndex(headersRow, ['ID DB', 'Id Db']) !== -1
			? findHeaderIndex(headersRow, ['ID DB', 'Id Db'])
			: findHeaderIndexByTokens(headersRow, ['id'], ['db']);
	if (idDbIdx === -1) {
		throw new Error(`Colonne "ID DB/Id Db" introuvable dans la feuille "${tabName}".`);
	}

	const rowNumberById = new Map<string, number>();
	for (let i = 1; i < rows.length; i++) {
		const idVal = (rows[i]?.[idDbIdx] ?? '').trim();
		if (idVal) rowNumberById.set(idVal, i + 1);
	}

	return {
		tabEncoded,
		tabA1: `'${tabName.replaceAll("'", "''")}'`,
		headersRow,
		idDbIdx,
		lastCol: toColA1(headersRow.length - 1),
		rowNumberById,
		...(options?.includeDataRows ? { dataRows: rows } : {})
	};
}

async function getSheetIdByTitle(
	auth: { spreadsheetId: string; headers: HeadersInit; apiKey?: string },
	title: string
): Promise<number | null> {
	const res = await sheetsFetch(
		auth.spreadsheetId,
		auth.headers,
		`?fields=sheets.properties(sheetId,title)`,
		auth.apiKey
	);
	if (!res.ok) return null;
	const json = (await res.json()) as SheetMetaResponse;
	const match = (json.sheets ?? []).find((s) => (s.properties?.title ?? '') === title);
	const id = match?.properties?.sheetId;
	return typeof id === 'number' ? id : null;
}

async function sortJeuxSheetByGameName(auth: {
	spreadsheetId: string;
	headers: HeadersInit;
	apiKey?: string;
}): Promise<void> {
	const tab = encodeURIComponent(SHEET_TAB_JEUX);
	const valuesRes = await sheetsFetch(
		auth.spreadsheetId,
		auth.headers,
		`/values/${tab}!A1:ZZ?majorDimension=ROWS`,
		auth.apiKey
	);
	if (!valuesRes.ok) return;
	const body = (await valuesRes.json()) as SheetsApiResponse;
	const rows = body.values ?? [];
	if (rows.length <= 2) return; // en-tête + au plus 1 ligne

	const headersRow = rows[0] ?? [];
	const gameNameIdx = findHeaderIndex(headersRow, ['Nom du jeu', 'Jeu']);
	if (gameNameIdx === -1) return;

	const sheetId = await getSheetIdByTitle(auth, SHEET_TAB_JEUX);
	if (sheetId == null) return;

	const sortRes = await sheetsFetch(auth.spreadsheetId, auth.headers, `:batchUpdate`, auth.apiKey, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			requests: [
				{
					sortRange: {
						range: {
							sheetId,
							startRowIndex: 1,
							endRowIndex: rows.length,
							startColumnIndex: 0,
							endColumnIndex: headersRow.length
						},
						sortSpecs: [{ dimensionIndex: gameNameIdx, sortOrder: 'ASCENDING' }]
					}
				}
			]
		})
	});
	if (!sortRes.ok) {
		const err = await sortRes.text().catch(() => '');
		throw new Error(`Sheets sort Jeux error (${sortRes.status}): ${err.slice(0, 500)}`);
	}
}

async function deleteRowsByTranslationIds(translationIds: string[]): Promise<void> {
	if (!translationIds.length) return;
	const auth = await getSheetsAuth();
	if (!auth) return;

	const tab = encodeURIComponent(SHEET_TAB_JEUX);
	const valuesRes = await sheetsFetch(
		auth.spreadsheetId,
		auth.headers,
		`/values/${tab}!A1:ZZ?majorDimension=ROWS`,
		auth.apiKey
	);
	if (!valuesRes.ok) return;
	const body = (await valuesRes.json()) as SheetsApiResponse;
	const rows = body.values ?? [];
	if (rows.length < 2) return;

	const headersRow = rows[0] ?? [];
	let idDbIdx = findHeaderIndex(headersRow, ['ID DB', 'Id Db']);
	if (idDbIdx === -1) idDbIdx = findHeaderIndexByTokens(headersRow, ['id'], ['db']);
	if (idDbIdx === -1) return;

	const ids = new Set(translationIds);
	const startIndices: number[] = [];
	for (let r = 1; r < rows.length; r++) {
		const v = (rows[r]?.[idDbIdx] ?? '').trim();
		if (ids.has(v)) {
			// Sheet row r+1 -> deleteDimension uses 0-based index r
			startIndices.push(r);
		}
	}
	if (!startIndices.length) return;

	const sheetId = await getSheetIdByTitle(auth, SHEET_TAB_JEUX);
	if (sheetId == null) return;

	const requests = startIndices
		.sort((a, b) => b - a)
		.map((start) => ({
			deleteDimension: {
				range: {
					sheetId,
					dimension: 'ROWS',
					startIndex: start,
					endIndex: start + 1
				}
			}
		}));

	const delRes = await sheetsFetch(auth.spreadsheetId, auth.headers, `:batchUpdate`, auth.apiKey, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ requests })
	});
	if (!delRes.ok) {
		const err = await delRes.text().catch(() => '');
		throw new Error(`Sheets delete rows error (${delRes.status}): ${err.slice(0, 500)}`);
	}
	await sortJeuxSheetByGameName(auth);
}

export async function syncTranslationToGoogleSheet(translationId: string): Promise<void> {
	const auth = await getSheetsAuth();
	if (!auth) return;

	const [tr] = await db
		.select()
		.from(table.gameTranslation)
		.where(eq(table.gameTranslation.id, translationId))
		.limit(1);
	if (!tr) return;

	const [game] = await db.select().from(table.game).where(eq(table.game.id, tr.gameId)).limit(1);
	if (!game) return;

	const translatorId = tr.translatorId ?? null;
	const proofreaderId = tr.proofreaderId ?? null;

	const [translatorById] = translatorId
		? await db.select().from(table.translator).where(eq(table.translator.id, translatorId)).limit(1)
		: [];
	const [translatorByName] =
		translatorId && !translatorById
			? await db
					.select()
					.from(table.translator)
					.where(eq(table.translator.name, translatorId))
					.limit(1)
			: [];
	const translator = translatorById ?? translatorByName ?? null;

	const [proofreaderById] = proofreaderId
		? await db
				.select()
				.from(table.translator)
				.where(eq(table.translator.id, proofreaderId))
				.limit(1)
		: [];
	const [proofreaderByName] =
		proofreaderId && !proofreaderById
			? await db
					.select()
					.from(table.translator)
					.where(eq(table.translator.name, proofreaderId))
					.limit(1)
			: [];
	const proofreader = proofreaderById ?? proofreaderByName ?? null;

	const tab = encodeURIComponent(SHEET_TAB_JEUX);
	const getAllRes = await sheetsFetch(
		auth.spreadsheetId,
		auth.headers,
		`/values/${tab}!A1:ZZ?majorDimension=ROWS`,
		auth.apiKey
	);
	if (!getAllRes.ok) {
		const err = await getAllRes.text().catch(() => '');
		throw new Error(`Sheets read error (${getAllRes.status}): ${err.slice(0, 500)}`);
	}

	const body = (await getAllRes.json()) as SheetsApiResponse;
	const rows = body.values ?? [];
	if (rows.length === 0)
		throw new Error(`La feuille "${SHEET_TAB_JEUX}" est vide (en-têtes manquants).`);

	const headersRow = rows[0] ?? [];
	let idDbIdx = findHeaderIndex(headersRow, ['ID DB', 'Id Db']);
	if (idDbIdx === -1) {
		idDbIdx = findHeaderIndexByTokens(headersRow, ['id'], ['db']);
	}
	if (idDbIdx === -1) {
		throw new Error(`Colonne "ID DB" introuvable dans la feuille "${SHEET_TAB_JEUX}".`);
	}

	const lastCol = toColA1(headersRow.length - 1);
	const dataRows = rows.slice(1);
	let rowNumber = -1;
	for (let i = 0; i < dataRows.length; i++) {
		if ((dataRows[i]?.[idDbIdx] ?? '').trim() === tr.id) {
			rowNumber = i + 2;
			break;
		}
	}

	const rowValues = new Array(headersRow.length).fill('');
	populateJeuxRowValues(headersRow, rowValues, { tr, game, translator, proofreader });

	if (rowNumber !== -1) {
		const range = `${tab}!A${rowNumber}:${lastCol}${rowNumber}`;
		const res = await sheetsFetch(
			auth.spreadsheetId,
			auth.headers,
			`/values/${range}?valueInputOption=USER_ENTERED`,
			auth.apiKey,
			{
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ values: [rowValues] })
			}
		);
		if (!res.ok) {
			const err = await res.text().catch(() => '');
			throw new Error(`Sheets update error (${res.status}): ${err.slice(0, 500)}`);
		}
		await sortJeuxSheetByGameName(auth);
		return;
	}

	const appendRange = `${tab}!A:A`;
	const appendRes = await sheetsFetch(
		auth.spreadsheetId,
		auth.headers,
		`/values/${appendRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
		auth.apiKey,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ values: [rowValues] })
		}
	);
	if (!appendRes.ok) {
		const err = await appendRes.text().catch(() => '');
		throw new Error(`Sheets append error (${appendRes.status}): ${err.slice(0, 500)}`);
	}
	await sortJeuxSheetByGameName(auth);
}

export async function deleteTranslationFromGoogleSheet(translationId: string): Promise<void> {
	await deleteRowsByTranslationIds([translationId]);
}

export async function deleteGameTranslationsFromGoogleSheet(
	translationIds: string[]
): Promise<void> {
	await deleteRowsByTranslationIds(translationIds);
}

export async function syncGameTranslationsToGoogleSheet(gameId: string): Promise<void> {
	const rows = await db
		.select({ id: table.gameTranslation.id })
		.from(table.gameTranslation)
		.where(eq(table.gameTranslation.gameId, gameId));
	for (const row of rows) {
		await syncTranslationToGoogleSheet(row.id);
	}
}

export async function syncTranslatorToGoogleSheet(translatorId: string): Promise<void> {
	const auth = await getSheetsAuth();
	if (!auth) return;

	const [tr] = await db
		.select()
		.from(table.translator)
		.where(eq(table.translator.id, translatorId))
		.limit(1);
	if (!tr) return;

	const tab = encodeURIComponent(SHEET_TAB_TR);
	const getAllRes = await sheetsFetch(
		auth.spreadsheetId,
		auth.headers,
		`/values/${tab}!A1:ZZ?majorDimension=ROWS`,
		auth.apiKey
	);
	if (!getAllRes.ok) {
		const err = await getAllRes.text().catch(() => '');
		throw new Error(`Sheets read error (${getAllRes.status}): ${err.slice(0, 500)}`);
	}
	const body = (await getAllRes.json()) as SheetsApiResponse;
	const rows = body.values ?? [];
	if (rows.length === 0)
		throw new Error(`La feuille "${SHEET_TAB_TR}" est vide (en-têtes manquants).`);

	const headersRow = rows[0] ?? [];
	const headerIndex = new Map<string, number>();
	for (let i = 0; i < headersRow.length; i++) {
		headerIndex.set(normalizeHeader(headersRow[i] ?? ''), i);
	}
	const idx = (name: string): number => {
		const v = headerIndex.get(normalizeHeader(name));
		return v == null ? -1 : v;
	};

	const idDbIdx = idx('Id Db') !== -1 ? idx('Id Db') : idx('ID DB');
	if (idDbIdx === -1) {
		throw new Error(`Colonne "Id Db" introuvable dans la feuille "${SHEET_TAB_TR}".`);
	}

	const lastCol = toColA1(headersRow.length - 1);
	const dataRows = rows.slice(1);
	let rowNumber = -1;
	for (let i = 0; i < dataRows.length; i++) {
		if ((dataRows[i]?.[idDbIdx] ?? '').trim() === tr.id) {
			rowNumber = i + 2;
			break;
		}
	}

	const rowValues = new Array(headersRow.length).fill('');
	const set = (header: string, value: string) => {
		const i = idx(header);
		if (i !== -1) rowValues[i] = value;
	};

	set('Nom', tr.name ?? '');
	set('Pages', pagesToFormula(tr.pages));
	set('Id Discord', tr.discordId ?? '');
	set('Traduction', String(tr.tradCount ?? 0));
	set('Relecture', String(tr.readCount ?? 0));
	set('Id Db', tr.id);
	set('ID DB', tr.id);

	if (rowNumber !== -1) {
		const range = `${tab}!A${rowNumber}:${lastCol}${rowNumber}`;
		const res = await sheetsFetch(
			auth.spreadsheetId,
			auth.headers,
			`/values/${range}?valueInputOption=USER_ENTERED`,
			auth.apiKey,
			{
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ values: [rowValues] })
			}
		);
		if (!res.ok) {
			const err = await res.text().catch(() => '');
			throw new Error(`Sheets update error (${res.status}): ${err.slice(0, 500)}`);
		}
		return;
	}

	const appendRange = `${tab}!A:A`;
	const appendRes = await sheetsFetch(
		auth.spreadsheetId,
		auth.headers,
		`/values/${appendRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
		auth.apiKey,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ values: [rowValues] })
		}
	);
	if (!appendRes.ok) {
		const err = await appendRes.text().catch(() => '');
		throw new Error(`Sheets append error (${appendRes.status}): ${err.slice(0, 500)}`);
	}
}

function buildJeuxRow(
	headersRow: string[],
	input: {
		tr: typeof table.gameTranslation.$inferSelect;
		game: typeof table.game.$inferSelect;
		translator: typeof table.translator.$inferSelect | null;
		proofreader: typeof table.translator.$inferSelect | null;
	}
): string[] {
	const rowValues = new Array(headersRow.length).fill('');
	populateJeuxRowValues(headersRow, rowValues, input);
	return rowValues;
}

function buildTranslatorRow(
	headersRow: string[],
	tr: typeof table.translator.$inferSelect
): string[] {
	const rowValues = new Array(headersRow.length).fill('');
	const set = (headers: string | string[], value: string) => {
		const i = findHeaderIndex(headersRow, Array.isArray(headers) ? headers : [headers]);
		if (i !== -1) rowValues[i] = value;
	};
	set('Nom', tr.name ?? '');
	set('Pages', pagesToFormula(tr.pages));
	set('Id Discord', tr.discordId ?? '');
	set('Traduction', String(tr.tradCount ?? 0));
	set('Relecture', String(tr.readCount ?? 0));
	set(['Id Db', 'ID DB'], tr.id);
	return rowValues;
}

export type SyncDbToSpreadsheetBulkOptions = {
	/**
	 * Ne met à jour / append que ces IDs de traduction sur l’onglet Jeux.
	 * La purge des lignes orphelines reste toujours exécutée.
	 */
	onlyJeuxTranslationIds?: Set<string>;
	/**
	 * N’écrit aucune ligne Jeux (ni update ni append), uniquement purge orphelins + onglet TR.
	 */
	skipJeuxRowWrites?: boolean;
	/** Ne pas resynchroniser l’onglet Traducteurs/Relecteurs (gain de temps si inchangé). */
	skipTranslatorTab?: boolean;
};

export async function syncDbToSpreadsheetBulk(
	onProgress?: (message: string) => void,
	options: SyncDbToSpreadsheetBulkOptions = {}
): Promise<{
	totalTranslations: number;
	totalTranslators: number;
	syncedTranslations: number;
	syncedTranslators: number;
	/** Lignes Jeux supprimées du spreadsheet (ID DB absent de la base). */
	prunedJeuxRows: number;
	errors: string[];
	/** Un sous-ensemble de lignes Jeux a été synchronisé (hors purge). */
	jeuxPartial?: boolean;
}> {
	onProgress?.('Sheets : vérification auth / configuration…');
	const auth = await getSheetsAuth();
	if (!auth) {
		return {
			totalTranslations: 0,
			totalTranslators: 0,
			syncedTranslations: 0,
			syncedTranslators: 0,
			prunedJeuxRows: 0,
			errors: ['Configuration Google Sheets absente (OAuth/API key/spreadsheet ID).']
		};
	}

	onProgress?.('Sheets : lecture base (traductions + traducteurs)…');
	const [translationsInitial, translators] = await Promise.all([
		db.select().from(table.gameTranslation),
		db.select().from(table.translator)
	]);
	let translations = translationsInitial;
	const errors: string[] = [];
	let prunedJeuxRows = 0;
	const { onlyJeuxTranslationIds, skipJeuxRowWrites, skipTranslatorTab } = options;
	let jeuxPartial = false;
	let jeuxRowsWritten = 0;

	try {
		const jeuxFilter =
			onlyJeuxTranslationIds && onlyJeuxTranslationIds.size > 0 ? onlyJeuxTranslationIds : null;

		onProgress?.('Sheets Jeux : lecture feuille (AC feuille→base + index des lignes)…');
		const jeuxSnap = await getSheetSnapshot(auth, SHEET_TAB_JEUX, { includeDataRows: true });
		if (jeuxSnap.dataRows) {
			await applyAcColumnFromJeuxSheetToDb(jeuxSnap.headersRow, jeuxSnap.dataRows, onProgress);
			translations = await db.select().from(table.gameTranslation);
		}

		if (skipJeuxRowWrites) {
			onProgress?.(
				`Sheets Jeux : pas d’écriture (inchangé), purge orphelins seulement (${translations.length} trad. en DB)…`
			);
			jeuxPartial = true;
		} else {
			if (jeuxFilter) {
				onProgress?.(
					`Sheets Jeux : sync partielle (${jeuxFilter.size} trad. ciblée(s) / ${translations.length} en DB)…`
				);
				jeuxPartial = true;
			} else {
				onProgress?.(`Sheets Jeux : écriture depuis la base (${translations.length} traductions)…`);
			}
			const allGames = await db.select().from(table.game);
			const gameMap = new Map(allGames.map((g) => [g.id, g]));
			const translatorMap = new Map(translators.map((t) => [t.id, t]));

			const updates: Array<{ range: string; values: string[][] }> = [];
			const appends: string[][] = [];
			for (const tr of translations) {
				if (jeuxFilter && !jeuxFilter.has(tr.id)) continue;
				try {
					const game = gameMap.get(tr.gameId);
					if (!game) continue;
					const translator = tr.translatorId ? (translatorMap.get(tr.translatorId) ?? null) : null;
					const proofreader = tr.proofreaderId
						? (translatorMap.get(tr.proofreaderId) ?? null)
						: null;
					const row = buildJeuxRow(jeuxSnap.headersRow, { tr, game, translator, proofreader });
					const rowNumber = jeuxSnap.rowNumberById.get(tr.id);
					if (rowNumber) {
						updates.push({
							range: `${jeuxSnap.tabA1}!A${rowNumber}:${jeuxSnap.lastCol}${rowNumber}`,
							values: [row]
						});
					} else {
						appends.push(row);
					}
					jeuxRowsWritten++;
				} catch (err) {
					errors.push(
						`translation ${tr.id}: ${err instanceof Error ? err.message : 'erreur inconnue'}`
					);
				}
			}
			onProgress?.(
				`Sheets Jeux : ${updates.length} mise(s) à jour, ${appends.length} ligne(s) à ajouter…`
			);
			for (let i = 0; i < updates.length; i += 200) {
				const end = Math.min(i + 200, updates.length);
				onProgress?.(`Sheets Jeux : envoi batch mises à jour ${i + 1}–${end}/${updates.length}…`);
				await sheetsBatchUpdate(auth, updates.slice(i, i + 200));
			}
			if (appends.length > 0) {
				for (let i = 0; i < appends.length; i += 500) {
					const end = Math.min(i + 500, appends.length);
					onProgress?.(`Sheets Jeux : append lignes ${i + 1}–${end}/${appends.length}…`);
					const res = await sheetsFetch(
						auth.spreadsheetId,
						auth.headers,
						`/values/${jeuxSnap.tabEncoded}!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
						auth.apiKey,
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ values: appends.slice(i, i + 500) })
						}
					);
					if (!res.ok) {
						const err = await res.text().catch(() => '');
						throw new Error(`Sheets append Jeux error (${res.status}): ${err.slice(0, 500)}`);
					}
				}
			}
			if (appends.length > 0 || !jeuxPartial) {
				onProgress?.('Sheets Jeux : tri par nom de jeu…');
				await sortJeuxSheetByGameName(auth);
			} else {
				onProgress?.('Sheets Jeux : pas de tri (mises à jour in-place seulement)');
			}
		}

		const dbTranslationIds = new Set(translations.map((t) => t.id));
		const snapAfter = skipJeuxRowWrites ? jeuxSnap : await getSheetSnapshot(auth, SHEET_TAB_JEUX);
		const orphanJeuxIds = [...snapAfter.rowNumberById.keys()].filter(
			(id) => !dbTranslationIds.has(id)
		);
		if (orphanJeuxIds.length > 0) {
			onProgress?.(`Sheets Jeux : suppression ${orphanJeuxIds.length} ligne(s) orpheline(s)…`);
			await deleteRowsByTranslationIds(orphanJeuxIds);
			prunedJeuxRows = orphanJeuxIds.length;
		} else {
			onProgress?.('Sheets Jeux : aucune ligne orpheline à supprimer');
		}
	} catch (err) {
		errors.push(`bulk Jeux: ${err instanceof Error ? err.message : 'erreur inconnue'}`);
	}

	try {
		if (skipTranslatorTab) {
			onProgress?.('Sheets TR : ignoré (aucun nouveau traducteur / relecteur dans ce flux)');
		} else {
			onProgress?.(`Sheets TR : snapshot + sync (${translators.length} traducteur(s))…`);
			const trSnap = await getSheetSnapshot(auth, SHEET_TAB_TR);
			const updates: Array<{ range: string; values: string[][] }> = [];
			const appends: string[][] = [];
			for (const tr of translators) {
				try {
					const row = buildTranslatorRow(trSnap.headersRow, tr);
					const rowNumber = trSnap.rowNumberById.get(tr.id);
					if (rowNumber) {
						updates.push({
							range: `${trSnap.tabA1}!A${rowNumber}:${trSnap.lastCol}${rowNumber}`,
							values: [row]
						});
					} else {
						appends.push(row);
					}
				} catch (err) {
					errors.push(
						`translator ${tr.id}: ${err instanceof Error ? err.message : 'erreur inconnue'}`
					);
				}
			}
			onProgress?.(`Sheets TR : ${updates.length} mise(s) à jour, ${appends.length} ajout(s)…`);
			for (let i = 0; i < updates.length; i += 200) {
				const end = Math.min(i + 200, updates.length);
				onProgress?.(`Sheets TR : batch mises à jour ${i + 1}–${end}/${updates.length}…`);
				await sheetsBatchUpdate(auth, updates.slice(i, i + 200));
			}
			if (appends.length > 0) {
				for (let i = 0; i < appends.length; i += 500) {
					const end = Math.min(i + 500, appends.length);
					onProgress?.(`Sheets TR : append ${i + 1}–${end}/${appends.length}…`);
					const res = await sheetsFetch(
						auth.spreadsheetId,
						auth.headers,
						`/values/${trSnap.tabEncoded}!A:A:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
						auth.apiKey,
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ values: appends.slice(i, i + 500) })
						}
					);
					if (!res.ok) {
						const err = await res.text().catch(() => '');
						throw new Error(`Sheets append TR error (${res.status}): ${err.slice(0, 500)}`);
					}
				}
			}
		}
	} catch (err) {
		errors.push(
			`bulk Traducteurs/Relecteurs: ${err instanceof Error ? err.message : 'erreur inconnue'}`
		);
	}

	onProgress?.('Sheets : synchronisation bulk terminée');
	return {
		totalTranslations: translations.length,
		totalTranslators: translators.length,
		syncedTranslations: skipJeuxRowWrites ? 0 : jeuxPartial ? jeuxRowsWritten : translations.length,
		syncedTranslators: skipTranslatorTab ? 0 : translators.length,
		prunedJeuxRows,
		errors,
		jeuxPartial: jeuxPartial || undefined
	};
}

export async function syncMajToGoogleSheet(): Promise<void> {
	const auth = await getSheetsAuth();
	if (!auth) return;

	let todayRows: Array<{ status: string; gameName: string }>;
	try {
		todayRows = await db
			.select({ status: table.update.status, gameName: table.game.name })
			.from(table.update)
			.innerJoin(table.game, eq(table.update.gameId, table.game.id))
			.where(sql`DATE(${table.update.createdAt}) = CURRENT_DATE`);
	} catch {
		// Compat si la colonne `update.status` n'est pas encore migrée:
		// on considère temporairement tout en "update".
		const fallback = (await db.execute(sql`
			SELECT 'update'::varchar AS status, g.name AS game_name
			FROM "update" u
			JOIN game g ON g.id = u.game_id
			WHERE DATE(u.created_at) = CURRENT_DATE
		`)) as unknown as Array<{ status: string; game_name: string }>;
		todayRows = fallback.map((r) => ({ status: r.status, gameName: r.game_name }));
	}

	const byStatus = new Map<string, Set<string>>();
	for (const row of todayRows) {
		const key = row.status === 'adding' ? 'AJOUT DE JEU' : 'MISE À JOUR';
		if (!byStatus.has(key)) byStatus.set(key, new Set());
		if (row.gameName?.trim()) byStatus.get(key)!.add(row.gameName.trim());
	}

	const dateLabel = new Date().toLocaleDateString('fr-FR');
	const targetRows = [
		{
			statusLabel: 'AJOUT DE JEU',
			names: Array.from(byStatus.get('AJOUT DE JEU') ?? [])
		},
		{
			statusLabel: 'MISE À JOUR',
			names: Array.from(byStatus.get('MISE À JOUR') ?? [])
		}
	];

	const tab = encodeURIComponent(SHEET_TAB_MAJ);
	const res = await sheetsFetch(
		auth.spreadsheetId,
		auth.headers,
		`/values/${tab}!A1:ZZ?majorDimension=ROWS`,
		auth.apiKey
	);
	if (!res.ok) return;
	const body = (await res.json()) as SheetsApiResponse;
	const rows = body.values ?? [];
	if (rows.length === 0) return;

	const headers = rows[0] ?? [];
	const dateIdx =
		findHeaderIndex(headers, ['Date', 'Jour']) !== -1
			? findHeaderIndex(headers, ['Date', 'Jour'])
			: 0;
	const statusIdx =
		findHeaderIndex(headers, ['Status', 'Statut']) !== -1
			? findHeaderIndex(headers, ['Status', 'Statut'])
			: 1;
	const namesIdx =
		findHeaderIndex(headers, ['Nom des jeux', 'Jeux', 'Noms']) !== -1
			? findHeaderIndex(headers, ['Nom des jeux', 'Jeux', 'Noms'])
			: 2;

	const lastCol = toColA1(headers.length - 1);
	const toDeleteRowStarts: number[] = [];
	const updates: Array<{ range: string; values: string[][] }> = [];
	const insertsAtTop: string[][] = [];

	for (const target of targetRows) {
		const matching: number[] = [];
		for (let r = 1; r < rows.length; r++) {
			const rowDate = (rows[r]?.[dateIdx] ?? '').trim();
			const rowStatus = (rows[r]?.[statusIdx] ?? '').trim();
			if (
				rowDate === dateLabel &&
				normalizeHeader(rowStatus) === normalizeHeader(target.statusLabel)
			) {
				matching.push(r + 1);
			}
		}

		const namesText = target.names.join(',  ');
		if (!namesText) {
			if (matching.length > 0) {
				for (const rn of matching) toDeleteRowStarts.push(rn - 1);
			}
			continue;
		}

		const rowValues = new Array(headers.length).fill('');
		rowValues[dateIdx] = dateLabel;
		rowValues[statusIdx] = target.statusLabel;
		rowValues[namesIdx] = namesText;

		if (matching.length > 0) {
			const keep = matching[0]!;
			updates.push({
				range: `'${SHEET_TAB_MAJ}'!A${keep}:${lastCol}${keep}`,
				values: [rowValues]
			});
			for (const extra of matching.slice(1)) toDeleteRowStarts.push(extra - 1);
		} else {
			insertsAtTop.push(rowValues);
		}
	}

	if (updates.length > 0) {
		await sheetsBatchUpdate(auth, updates);
	}
	if (insertsAtTop.length > 0) {
		const sheetId = await getSheetIdByTitle(auth, SHEET_TAB_MAJ);
		if (sheetId == null) {
			throw new Error(`Feuille "${SHEET_TAB_MAJ}" introuvable.`);
		}
		const insertRes = await sheetsFetch(
			auth.spreadsheetId,
			auth.headers,
			`:batchUpdate`,
			auth.apiKey,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					requests: [
						{
							insertDimension: {
								range: {
									sheetId,
									dimension: 'ROWS',
									startIndex: 1,
									endIndex: 1 + insertsAtTop.length
								},
								inheritFromBefore: false
							}
						}
					]
				})
			}
		);
		if (!insertRes.ok) {
			const err = await insertRes.text().catch(() => '');
			throw new Error(`Sheets insert MAJ rows error (${insertRes.status}): ${err.slice(0, 500)}`);
		}

		const insertUpdates = insertsAtTop.map((rowValues, idx) => {
			const rowNumber = 2 + idx; // juste après l'en-tête
			return {
				range: `'${SHEET_TAB_MAJ}'!A${rowNumber}:${lastCol}${rowNumber}`,
				values: [rowValues]
			};
		});
		await sheetsBatchUpdate(auth, insertUpdates);
	}

	if (toDeleteRowStarts.length > 0) {
		const sheetId = await getSheetIdByTitle(auth, SHEET_TAB_MAJ);
		if (sheetId != null) {
			const requests = toDeleteRowStarts
				.sort((a, b) => b - a)
				.map((start) => ({
					deleteDimension: {
						range: { sheetId, dimension: 'ROWS', startIndex: start, endIndex: start + 1 }
					}
				}));
			await sheetsFetch(auth.spreadsheetId, auth.headers, `:batchUpdate`, auth.apiKey, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ requests })
			});
		}
	}
}
