import { featuredUpdatesScopeWhere } from '$lib/server/api/updates-scope-query';
import { getEffectiveConfig } from '$lib/server/app-config';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { getValidAccessToken } from '$lib/server/google-oauth';
import {
    getTranslatorActivityCounts,
    getTranslatorActivityCountsForId,
    loadTranslatorActivityCountsById,
    type TranslatorActivityCounts
} from '$lib/server/translator-activity-counts';
import { and, eq, inArray, or, sql } from 'drizzle-orm';

const SHEET_TAB_JEUX = 'Jeux';
const SHEET_TAB_TR = 'Traducteurs/Relecteurs';
const SHEET_TAB_MAJ = 'MAJ';

/** Préfixe fixe pour filtrer les alertes (monitoring / grep logs). */
export const JEUX_SYNC_ALERT_PREFIX = '[google-sheets-sync:ALERT]';

type JeuxSyncAlertMeta = {
	gameId?: string;
	translationId?: string;
	gameName?: string;
	context?: string;
};

function logJeuxSyncAlert(message: string, meta: JeuxSyncAlertMeta = {}, cause?: unknown): void {
	const line = [
		JEUX_SYNC_ALERT_PREFIX,
		message,
		meta.context && `context=${meta.context}`,
		meta.gameId && `gameId=${meta.gameId}`,
		meta.translationId && `translationId=${meta.translationId}`,
		meta.gameName && `jeu="${meta.gameName}"`
	]
		.filter(Boolean)
		.join(' ');

	if (cause !== undefined) {
		console.error(line, cause);
	} else {
		console.error(line);
	}
}

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

function optionalHeaderIndex(headersRow: string[], header: string): number {
	const normalizedHeaders = headersRow.map((h) => normalizeHeader(h ?? ''));
	const normalizedHeader = normalizeHeader(header);
	return normalizedHeaders.findIndex((h) => h === normalizedHeader);
}

function findHeaderIndex(headersRow: string[], header: string): number {
	const i = optionalHeaderIndex(headersRow, header);
	if (i !== -1) return i;

	throw new Error(`Colonne "${header}" introuvable dans les en-têtes de la feuille.`);
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
			return `https://lewdcorner.com/threads/${tid}`;
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
	const set = (header: string, value: string) => {
		const i = optionalHeaderIndex(headersRow, header);
		if (i !== -1) rowValues[i] = value;
	};

	const nomAffiche = formatJeuxNomAffiche(game.name ?? '', tr.translationName);
	const lienLabel = lienTradDisplayLabel(game, tr);

	set('SITE', formatWebsite(game.website));
	set('NOM DU JEU', asHyperlink(gameSpreadsheetLink(game), nomAffiche));
	set('VERSION', sheetLiteralVersionText(getJeuxGameVersionValue(tr, game)));
	set('TRAD. VER.', sheetLiteralVersionText(getTradVerValue(tr, game)));
	set('LIEN TRAD', asHyperlink(tr.tlink, lienLabel));
	set('STATUT', formatStatus(tr.status));
	set('TAGS', game.tags ?? '');
	set('TYPE', formatGameType(tr.gameType));
	const translatorLabel = translator?.name ?? '';
	set(
		'TRADUCTEUR',
		translatorLabel ? asHyperlink(firstPageLink(translator?.pages), translatorLabel) : ''
	);
	const proofreaderLabel = proofreader?.name ?? '';
	set(
		'RELECTEUR',
		proofreaderLabel ? asHyperlink(firstPageLink(proofreader?.pages), proofreaderLabel) : ''
	);
	set('TYPE DE TRADUCTION', formatTranslationType(tr.ttype));

	const idDbIdx = optionalHeaderIndex(headersRow, 'ID DB');
	if (idDbIdx === -1) {
		throw new Error('Colonne "ID DB" introuvable dans la feuille "Jeux".');
	}
	rowValues[idDbIdx] = tr.id;
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

function pagesToPlainText(pagesRaw: string | null | undefined): string {
	const pages = parsePages(pagesRaw)
		.map((p) => ({
			name: (p.name ?? '').trim(),
			link: (p.link ?? '').trim()
		}))
		.filter((p) => p.name || p.link);
	if (pages.length === 0) return '';
	return pages.map((p) => p.name || p.link).join('    ');
}

function buildPagesRichTextPayload(pagesRaw: string | null | undefined): {
	text: string;
	runs: Array<{
		startIndex: number;
		format: { link?: { uri: string }; underline: boolean };
	}>;
} {
	const pages = parsePages(pagesRaw)
		.map((p) => ({
			name: (p.name ?? '').trim(),
			link: (p.link ?? '').trim()
		}))
		.filter((p) => p.name || p.link);

	let text = '';
	const runs: Array<{
		startIndex: number;
		format: { link?: { uri: string }; underline: boolean };
	}> = [];
	for (let i = 0; i < pages.length; i++) {
		const page = pages[i];
		if (i > 0) {
			// Run neutre explicite pour casser lien + soulignement sur le séparateur.
			runs.push({ startIndex: text.length, format: { underline: false } });
			text += '    ';
		}
		const label = page.name || page.link;
		const startIndex = text.length;
		text += label;
		if (page.link) {
			runs.push({ startIndex, format: { link: { uri: page.link }, underline: true } });
		} else {
			runs.push({ startIndex, format: { underline: false } });
		}
	}
	return { text, runs };
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

async function sheetsSpreadsheetBatchUpdate(
	auth: { spreadsheetId: string; headers: HeadersInit; apiKey?: string },
	requests: unknown[]
): Promise<void> {
	if (requests.length === 0) return;
	const res = await sheetsFetch(auth.spreadsheetId, auth.headers, `:batchUpdate`, auth.apiKey, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ requests })
	});
	if (!res.ok) {
		const err = await res.text().catch(() => '');
		throw new Error(`Sheets batchUpdate(requests) error (${res.status}): ${err.slice(0, 500)}`);
	}
}

async function applyPagesRichTextInRows(
	auth: { spreadsheetId: string; headers: HeadersInit; apiKey?: string },
	params: {
		sheetId: number;
		pagesColIdx: number;
		rows: Array<{ rowNumber: number; pagesRaw: string | null | undefined }>;
	}
): Promise<void> {
	const requests = params.rows.map((row) => {
		const rich = buildPagesRichTextPayload(row.pagesRaw);
		return {
			updateCells: {
				range: {
					sheetId: params.sheetId,
					startRowIndex: row.rowNumber - 1,
					endRowIndex: row.rowNumber,
					startColumnIndex: params.pagesColIdx,
					endColumnIndex: params.pagesColIdx + 1
				},
				rows: [
					{
						values: [
							{
								userEnteredValue: { stringValue: rich.text },
								textFormatRuns: rich.runs
							}
						]
					}
				],
				fields: 'userEnteredValue,textFormatRuns'
			}
		};
	});

	for (let i = 0; i < requests.length; i += 200) {
		await sheetsSpreadsheetBatchUpdate(auth, requests.slice(i, i + 200));
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
	const idDbIdx = findHeaderIndex(headersRow, 'ID DB');
	if (idDbIdx === -1) {
		throw new Error(`Colonne "ID DB" introuvable dans la feuille "${tabName}".`);
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
	const gameNameIdx = findHeaderIndex(headersRow, 'NOM DU JEU');
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

function parseCountCell(value: string | undefined): number {
	const raw = (value ?? '').trim();
	if (!raw) return 0;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) ? n : 0;
}

async function sortTranslatorSheetByActivityDesc(auth: {
	spreadsheetId: string;
	headers: HeadersInit;
	apiKey?: string;
}): Promise<void> {
	const tab = encodeURIComponent(SHEET_TAB_TR);
	const valuesRes = await sheetsFetch(
		auth.spreadsheetId,
		auth.headers,
		`/values/${tab}!A1:ZZ?majorDimension=ROWS`,
		auth.apiKey
	);
	if (!valuesRes.ok) return;
	const body = (await valuesRes.json()) as SheetsApiResponse;
	const rows = body.values ?? [];
	if (rows.length <= 2) return;

	const headersRow = rows[0] ?? [];
	const tradIdx = findHeaderIndex(headersRow, 'TRADUCTION');
	const readIdx = findHeaderIndex(headersRow, 'RELECTURE');
	const nameIdx = findHeaderIndex(headersRow, 'NOM');
	if (tradIdx === -1 || readIdx === -1) return;

	const dataRows = rows.slice(1);
	const sortedRows = [...dataRows].sort((a, b) => {
		const aTotal = parseCountCell(a[tradIdx]) + parseCountCell(a[readIdx]);
		const bTotal = parseCountCell(b[tradIdx]) + parseCountCell(b[readIdx]);
		if (aTotal !== bTotal) return bTotal - aTotal; // Z→A sur (Traduction + Relecture)

		const aName = nameIdx === -1 ? '' : (a[nameIdx] ?? '').trim();
		const bName = nameIdx === -1 ? '' : (b[nameIdx] ?? '').trim();
		return aName.localeCompare(bName, 'fr', { sensitivity: 'base' });
	});

	const lastCol = toColA1(headersRow.length - 1);
	await sheetsBatchUpdate(auth, [
		{
			range: `'${SHEET_TAB_TR}'!A2:${lastCol}${sortedRows.length + 1}`,
			values: sortedRows
		}
	]);
}

async function reapplyTranslatorPagesRichText(auth: {
	spreadsheetId: string;
	headers: HeadersInit;
	apiKey?: string;
}): Promise<void> {
	const trSnap = await getSheetSnapshot(auth, SHEET_TAB_TR);
	const pagesColIdx = findHeaderIndex(trSnap.headersRow, 'PAGES');
	if (pagesColIdx === -1) return;

	const idDbIdx = findHeaderIndex(trSnap.headersRow, 'ID DB');
	if (idDbIdx === -1) return;

	const valuesRes = await sheetsFetch(
		auth.spreadsheetId,
		auth.headers,
		`/values/${trSnap.tabEncoded}!A1:ZZ?majorDimension=ROWS`,
		auth.apiKey
	);
	if (!valuesRes.ok) return;
	const valuesBody = (await valuesRes.json()) as SheetsApiResponse;
	const rows = valuesBody.values ?? [];
	if (rows.length <= 1) return;

	const ids = rows
		.slice(1)
		.map((row) => (row[idDbIdx] ?? '').trim())
		.filter((id) => id.length > 0);
	if (ids.length === 0) return;

	const translators = await db
		.select({ id: table.translator.id, pages: table.translator.pages })
		.from(table.translator)
		.where(inArray(table.translator.id, ids));
	const pagesByTranslatorId = new Map(translators.map((t) => [t.id, t.pages]));
	const sheetId = await getSheetIdByTitle(auth, SHEET_TAB_TR);
	if (sheetId == null) return;

	const rowsForRichText = rows
		.slice(1)
		.map((row, i) => {
			const id = (row[idDbIdx] ?? '').trim();
			return {
				rowNumber: i + 2,
				pagesRaw: pagesByTranslatorId.get(id) ?? null
			};
		})
		.filter((entry) => entry.pagesRaw != null);
	if (rowsForRichText.length === 0) return;

	await applyPagesRichTextInRows(auth, {
		sheetId,
		pagesColIdx,
		rows: rowsForRichText
	});
}

/**
 * Réapplique un format "Automatique / Général" sur la plage utile d'un onglet.
 * Permet de corriger les feuilles passées en "Texte brut" après des opérations d'édition.
 */
async function normalizeSheetCellFormat(
	auth: { spreadsheetId: string; headers: HeadersInit; apiKey?: string },
	tabName: string
): Promise<void> {
	const snap = await getSheetSnapshot(auth, tabName, { includeDataRows: true });
	const sheetId = await getSheetIdByTitle(auth, tabName);
	if (sheetId == null) return;

	const rowCount = Math.max(snap.dataRows?.length ?? 0, 1);
	const colCount = Math.max(snap.headersRow.length, 1);
	const requests = [
		{
			repeatCell: {
				range: {
					sheetId,
					startRowIndex: 0,
					endRowIndex: rowCount,
					startColumnIndex: 0,
					endColumnIndex: colCount
				},
				cell: {
					userEnteredFormat: {
						numberFormat: {
							type: 'NUMBER',
							pattern: 'General'
						}
					}
				},
				fields: 'userEnteredFormat.numberFormat'
			}
		}
	];
	await sheetsSpreadsheetBatchUpdate(auth, requests);
}

async function normalizeMajSheetFormats(
	auth: { spreadsheetId: string; headers: HeadersInit; apiKey?: string },
	headersRow: string[],
	rowCount: number
): Promise<void> {
	const sheetId = await getSheetIdByTitle(auth, SHEET_TAB_MAJ);
	if (sheetId == null) return;

	const dateIdx = findHeaderIndex(headersRow, 'DATE');
	const colCount = Math.max(headersRow.length, 1);
	const safeRowCount = Math.max(rowCount, 1);

	const requests: unknown[] = [];
	for (let col = 0; col < colCount; col++) {
		if (col === dateIdx) continue;
		requests.push({
			repeatCell: {
				range: {
					sheetId,
					startRowIndex: 0,
					endRowIndex: safeRowCount,
					startColumnIndex: col,
					endColumnIndex: col + 1
				},
				cell: {
					userEnteredFormat: {
						numberFormat: {
							type: 'TEXT'
						}
					}
				},
				fields: 'userEnteredFormat.numberFormat'
			}
		});
	}

	requests.push({
		repeatCell: {
			range: {
				sheetId,
				startRowIndex: 0,
				endRowIndex: safeRowCount,
				startColumnIndex: dateIdx,
				endColumnIndex: dateIdx + 1
			},
			cell: {
				userEnteredFormat: {
					numberFormat: {
						type: 'DATE',
						pattern: 'dd/mm/yyyy'
					}
				}
			},
			fields: 'userEnteredFormat.numberFormat'
		}
	});

	await sheetsSpreadsheetBatchUpdate(auth, requests);
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
	const idDbIdx = findHeaderIndex(headersRow, 'ID DB');
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

/**
 * Synchronise une traduction vers l’onglet Jeux.
 * @returns `true` si la ligne a été écrite/mise à jour, `false` sinon (alerte loguée).
 */
export async function syncTranslationToGoogleSheet(
	translationId: string,
	context = 'unspecified'
): Promise<boolean> {
	const meta = { translationId, context };

	try {
		const auth = await getSheetsAuth();
		if (!auth) {
			logJeuxSyncAlert(
				'Sync Jeux ignorée : Google Sheets non configuré (OAuth ou clé API + ID spreadsheet).',
				meta
			);
			return false;
		}

		const [tr] = await db
			.select()
			.from(table.gameTranslation)
			.where(eq(table.gameTranslation.id, translationId))
			.limit(1);
		if (!tr) {
			logJeuxSyncAlert('Sync Jeux impossible : traduction introuvable en base.', meta);
			return false;
		}

		const [game] = await db
			.select()
			.from(table.game)
			.where(eq(table.game.id, tr.gameId))
			.limit(1);
		if (!game) {
			logJeuxSyncAlert('Sync Jeux impossible : jeu introuvable en base.', {
				...meta,
				gameId: tr.gameId
			});
			return false;
		}

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
	const idDbIdx = findHeaderIndex(headersRow, 'ID DB');

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
		await normalizeSheetCellFormat(auth, SHEET_TAB_JEUX);
		return true;
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
	await normalizeSheetCellFormat(auth, SHEET_TAB_JEUX);
	return true;
	} catch (cause) {
		const [tr] = await db
			.select({ gameId: table.gameTranslation.gameId })
			.from(table.gameTranslation)
			.where(eq(table.gameTranslation.id, translationId))
			.limit(1);
		const [game] = tr
			? await db
					.select({ id: table.game.id, name: table.game.name })
					.from(table.game)
					.where(eq(table.game.id, tr.gameId))
					.limit(1)
			: [];
		logJeuxSyncAlert(
			'Échec sync Jeux (traduction non présente sur le spreadsheet).',
			{
				translationId,
				context,
				gameId: game?.id,
				gameName: game?.name ?? undefined
			},
			cause
		);
		return false;
	}
}

/** Lance `syncTranslationToGoogleSheet` en arrière-plan (alertes déjà loguées). */
export function voidSyncTranslationToGoogleSheet(translationId: string, context: string): void {
	void syncTranslationToGoogleSheet(translationId, context);
}

export async function deleteTranslationFromGoogleSheet(translationId: string): Promise<void> {
	await deleteRowsByTranslationIds([translationId]);
}

export async function deleteGameTranslationsFromGoogleSheet(
	translationIds: string[]
): Promise<void> {
	await deleteRowsByTranslationIds(translationIds);
}

/**
 * Synchronise toutes les traductions d’un jeu vers l’onglet Jeux.
 * @returns nombre de traductions synchronisées avec succès
 */
export async function syncGameTranslationsToGoogleSheet(
	gameId: string,
	context = 'unspecified'
): Promise<number> {
	const [game] = await db
		.select({ id: table.game.id, name: table.game.name })
		.from(table.game)
		.where(eq(table.game.id, gameId))
		.limit(1);

	const rows = await db
		.select({ id: table.gameTranslation.id })
		.from(table.gameTranslation)
		.where(eq(table.gameTranslation.gameId, gameId));

	const alertMeta = {
		gameId,
		gameName: game?.name ?? undefined,
		context
	};

	if (rows.length === 0) {
		logJeuxSyncAlert(
			'Sync Jeux ignorée : le jeu n’a aucune traduction en base (aucune ligne sur l’onglet Jeux).',
			alertMeta
		);
		return 0;
	}

	let ok = 0;
	const failedIds: string[] = [];
	for (const row of rows) {
		if (await syncTranslationToGoogleSheet(row.id, context)) {
			ok += 1;
		} else {
			failedIds.push(row.id);
		}
	}

	if (failedIds.length > 0) {
		logJeuxSyncAlert(
			`Sync Jeux partielle : ${failedIds.length}/${rows.length} traduction(s) non synchronisée(s).`,
			{ ...alertMeta, translationId: failedIds.join(',') }
		);
	}

	return ok;
}

/** Lance `syncGameTranslationsToGoogleSheet` en arrière-plan (alertes déjà loguées). */
export function voidSyncGameTranslationsToGoogleSheet(gameId: string, context: string): void {
	void syncGameTranslationsToGoogleSheet(gameId, context);
}

/** Recalcule Traduction/Relecture sur l’onglet TR (non bloquant, dédoublonne les ID). */
export function voidSyncTranslatorActivityCountsToGoogleSheet(
	...translatorIds: Array<string | null | undefined>
): void {
	const seen = new Set<string>();
	for (const raw of translatorIds) {
		if (raw == null) continue;
		const id = String(raw).trim();
		if (!id || seen.has(id)) continue;
		seen.add(id);
		void syncTranslatorToGoogleSheet(id).catch((err) => {
			console.warn(`[google-sheets-sync] translator activity sync failed (${id}):`, err);
		});
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

	const idDbIdx = idx('ID DB');
	if (idDbIdx === -1) {
		throw new Error(`Colonne "ID DB" introuvable dans la feuille "${SHEET_TAB_TR}".`);
	}
	const pagesColIdx = findHeaderIndex(headersRow, 'PAGES');
	const sheetId = await getSheetIdByTitle(auth, SHEET_TAB_TR);

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
		const i = findHeaderIndex(headersRow, header);
		rowValues[i] = value;
	};

	set('NOM', tr.name ?? '');
	set('PAGES', pagesToPlainText(tr.pages));
	const activity = await getTranslatorActivityCountsForId(tr.id);
	set('TRADUCTION', String(activity.tradCount));
	set('RELECTURE', String(activity.readCount));
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
		if (pagesColIdx !== -1 && sheetId != null) {
			try {
				await applyPagesRichTextInRows(auth, {
					sheetId,
					pagesColIdx,
					rows: [{ rowNumber, pagesRaw: tr.pages }]
				});
			} catch (err) {
				console.warn('[google-sheets-sync] rich text pages update failed:', err);
			}
		}
		await sortTranslatorSheetByActivityDesc(auth);
		await reapplyTranslatorPagesRichText(auth);
		await normalizeSheetCellFormat(auth, SHEET_TAB_TR);
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
	const appendedRowNumberFromResponse = await (async (): Promise<number | null> => {
		try {
			const appendBody = (await appendRes.json()) as { updates?: { updatedRange?: string } };
			const updatedRange = appendBody.updates?.updatedRange ?? '';
			const m = updatedRange.match(/![A-Z]+(\d+):/);
			return m ? Number.parseInt(m[1] ?? '', 10) : null;
		} catch {
			return null;
		}
	})();
	let appendedRowNumber: number | null = appendedRowNumberFromResponse;
	if (!appendedRowNumber) {
		const snap = await getSheetSnapshot(auth, SHEET_TAB_TR);
		appendedRowNumber = snap.rowNumberById.get(tr.id) ?? null;
	}
	if (appendedRowNumber) {
		if (pagesColIdx !== -1 && sheetId != null) {
			try {
				await applyPagesRichTextInRows(auth, {
					sheetId,
					pagesColIdx,
					rows: [{ rowNumber: appendedRowNumber, pagesRaw: tr.pages }]
				});
			} catch (err) {
				console.warn('[google-sheets-sync] rich text pages append failed:', err);
			}
		}
	}
	await sortTranslatorSheetByActivityDesc(auth);
	await reapplyTranslatorPagesRichText(auth);
	await normalizeSheetCellFormat(auth, SHEET_TAB_TR);
}

/**
 * Resynchronise les lignes "Jeux" où un traducteur/relecteur est présent
 * afin de mettre à jour le lien basé sur sa première page.
 */
export async function syncTranslatorLinksInJeuxSheet(translatorId: string): Promise<void> {
	const refs = await db
		.select({ id: table.gameTranslation.id })
		.from(table.gameTranslation)
		.where(
			or(
				eq(table.gameTranslation.translatorId, translatorId),
				eq(table.gameTranslation.proofreaderId, translatorId)
			)
		);

	for (const row of refs) {
		await syncTranslationToGoogleSheet(row.id, 'translator-links-resync');
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
	tr: typeof table.translator.$inferSelect,
	activity: TranslatorActivityCounts
): string[] {
	const rowValues = new Array(headersRow.length).fill('');
	const set = (headers: string, value: string) => {
		const i = findHeaderIndex(headersRow, headers);
		if (i !== -1) rowValues[i] = value;
	};
	set('NOM', tr.name);
	set('PAGES', pagesToPlainText(tr.pages));
	set('TRADUCTION', String(activity.tradCount));
	set('RELECTURE', String(activity.readCount));
	set('ID DB', tr.id);
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
	const translations = translationsInitial;
	const errors: string[] = [];
	let prunedJeuxRows = 0;
	const { onlyJeuxTranslationIds, skipJeuxRowWrites, skipTranslatorTab } = options;
	let jeuxPartial = false;
	let jeuxRowsWritten = 0;

	try {
		const jeuxFilter =
			onlyJeuxTranslationIds && onlyJeuxTranslationIds.size > 0 ? onlyJeuxTranslationIds : null;

		onProgress?.('Sheets Jeux : lecture feuille (index des lignes)…');
		const jeuxSnap = await getSheetSnapshot(auth, SHEET_TAB_JEUX);

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
			onProgress?.('Sheets Jeux : normalisation du format des cellules…');
			await normalizeSheetCellFormat(auth, SHEET_TAB_JEUX);
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
			const activityCountsById = await loadTranslatorActivityCountsById();
			const updates: Array<{ range: string; values: string[][] }> = [];
			const appends: string[][] = [];
			for (const tr of translators) {
				try {
					const activity = getTranslatorActivityCounts(activityCountsById, tr.id);
					const row = buildTranslatorRow(trSnap.headersRow, tr, activity);
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
			const pagesColIdx = findHeaderIndex(trSnap.headersRow, 'PAGES');
			const sheetId = await getSheetIdByTitle(auth, SHEET_TAB_TR);
			if (pagesColIdx !== -1 && sheetId != null) {
				const trSnapAfter = await getSheetSnapshot(auth, SHEET_TAB_TR);
				const rowsForRichText = translators
					.map((tr) => ({
						rowNumber: trSnapAfter.rowNumberById.get(tr.id) ?? -1,
						pagesRaw: tr.pages
					}))
					.filter((entry) => entry.rowNumber > 0);
				try {
					await applyPagesRichTextInRows(auth, {
						sheetId,
						pagesColIdx,
						rows: rowsForRichText
					});
				} catch (err) {
					errors.push(
						`bulk TR rich text pages: ${err instanceof Error ? err.message : 'erreur inconnue'}`
					);
				}
			}
			onProgress?.('Sheets TR : tri Z→A sur (Traduction + Relecture)…');
			await sortTranslatorSheetByActivityDesc(auth);
			onProgress?.('Sheets TR : restauration des liens rich text colonne Pages…');
			await reapplyTranslatorPagesRichText(auth);
			onProgress?.('Sheets TR : normalisation du format des cellules…');
			await normalizeSheetCellFormat(auth, SHEET_TAB_TR);
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
		const featuredWhere = await featuredUpdatesScopeWhere();
		todayRows = await db
			.select({ status: table.update.status, gameName: table.game.name })
			.from(table.update)
			.innerJoin(table.game, eq(table.update.gameId, table.game.id))
			.where(and(sql`DATE(${table.update.createdAt}) = CURRENT_DATE`, featuredWhere));
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
	const dateIdx = findHeaderIndex(headers, 'DATE');
	const statusIdx = findHeaderIndex(headers, 'TYPE');
	const namesIdx = findHeaderIndex(headers, 'JEUX');

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

	const refreshed = await sheetsFetch(
		auth.spreadsheetId,
		auth.headers,
		`/values/${tab}!A1:ZZ?majorDimension=ROWS`,
		auth.apiKey
	);
	if (refreshed.ok) {
		const refreshedBody = (await refreshed.json()) as SheetsApiResponse;
		const refreshedRows = refreshedBody.values ?? [];
		const refreshedHeaders = refreshedRows[0] ?? headers;
		await normalizeMajSheetFormats(auth, refreshedHeaders, refreshedRows.length);
	}
}
