import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { getValidAccessToken } from '$lib/server/google-oauth';
import { eq } from 'drizzle-orm';

const SHEET_TAB_JEUX = 'Jeux';
const SHEET_TAB_TR = 'Traducteurs/Relecteurs';

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
	// Feuille FR => séparateur ';'
	return `=HYPERLINK("${safeUrl}"; "${safeLabel}")`;
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
	const [cfg] = await db.select().from(table.config).where(eq(table.config.id, 'main')).limit(1);
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
};

async function getSheetSnapshot(
	auth: { spreadsheetId: string; headers: HeadersInit; apiKey?: string },
	tabName: string
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
		rowNumberById
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
	const idDbIdx = findHeaderIndex(headersRow, ['ID DB', 'Id Db', 'ID']);
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

	const gameName = game.name ?? '';
	const trName = tr.translationName?.trim() || '';
	const nomAffiche = trName ? `${gameName} - ${trName}` : gameName;
	const tname = formatTranslationKind(tr.tname);

	const rowValues = new Array(headersRow.length).fill('');
	const set = (headers: string | string[], value: string) => {
		const list = Array.isArray(headers) ? headers : [headers];
		const i = findHeaderIndex(headersRow, list);
		if (i !== -1) {
			rowValues[i] = value;
		}
	};

	set('Site', formatWebsite(game.website));
	set(['Nom du jeu', 'Jeu'], asHyperlink(game.link, nomAffiche));
	set('Version', game.gameVersion ?? '');
	set(
		['Trad. Ver.', 'Trad Ver', 'Trad. Ver', 'TRAD. VER.', 'Version trad', 'Version traduction'],
		tr.tversion ?? ''
	);
	set(['Lien Trad', 'Lien traduction'], asHyperlink(tr.tlink, tname));
	set(['Status', 'Statut'], formatStatus(tr.status));
	set('Tags', game.tags ?? '');
	set('Type', formatGameType(game.type));
	const translatorLabel = translator?.name ?? '';
	const translatorFirstLink = firstPageLink(translator?.pages);
	set(
		['Traducteur', 'Traducteurs', 'TRADUCTEUR', 'TRADUCTEURS'],
		translatorLabel ? asHyperlink(translatorFirstLink, translatorLabel) : ''
	);

	const proofreaderLabel = proofreader?.name ?? '';
	const proofreaderFirstLink = firstPageLink(proofreader?.pages);
	set(
		['Relecteur', 'Relecteurs', 'RELECTEUR', 'RELECTEURS'],
		proofreaderLabel ? asHyperlink(proofreaderFirstLink, proofreaderLabel) : ''
	);
	set(['Type de traduction', 'Type traduction'], formatTranslationType(tr.ttype));
	set(['ID DB', 'Id Db'], tr.id);

	// Filet de sécurité pour des en-têtes atypiques/non standard
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
	if (tradVerIdx !== -1) rowValues[tradVerIdx] = tr.tversion ?? '';
	if (idDbIdx !== -1) rowValues[idDbIdx] = tr.id;

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
	const { tr, game, translator, proofreader } = input;
	const rowValues = new Array(headersRow.length).fill('');
	const set = (headers: string | string[], value: string) => {
		const i = findHeaderIndex(headersRow, Array.isArray(headers) ? headers : [headers]);
		if (i !== -1) rowValues[i] = value;
	};

	const gameName = game.name ?? '';
	const trName = tr.translationName?.trim() || '';
	const nomAffiche = trName ? `${gameName} - ${trName}` : gameName;
	const tname = formatTranslationKind(tr.tname);

	set('Site', formatWebsite(game.website));
	set(['Nom du jeu', 'Jeu'], asHyperlink(game.link, nomAffiche));
	set('Version', game.gameVersion ?? '');
	set(
		['Trad. Ver.', 'Trad Ver', 'TRAD. VER.', 'Version trad', 'Version traduction'],
		tr.tversion ?? ''
	);
	set(['Lien Trad', 'Lien traduction'], asHyperlink(tr.tlink, tname));
	set(['Status', 'Statut'], formatStatus(tr.status));
	set('Tags', game.tags ?? '');
	set('Type', formatGameType(game.type));
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
	if (tradVerIdx !== -1) rowValues[tradVerIdx] = tr.tversion ?? '';
	const idIdx = findHeaderIndex(headersRow, ['ID DB', 'Id Db']);
	if (idIdx !== -1) rowValues[idIdx] = tr.id;
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

export async function syncDbToSpreadsheetBulk(): Promise<{
	totalTranslations: number;
	totalTranslators: number;
	syncedTranslations: number;
	syncedTranslators: number;
	errors: string[];
}> {
	const auth = await getSheetsAuth();
	if (!auth) {
		return {
			totalTranslations: 0,
			totalTranslators: 0,
			syncedTranslations: 0,
			syncedTranslators: 0,
			errors: ['Configuration Google Sheets absente (OAuth/API key/spreadsheet ID).']
		};
	}

	const [translations, translators] = await Promise.all([
		db.select().from(table.gameTranslation),
		db.select().from(table.translator)
	]);
	const errors: string[] = [];

	try {
		const jeuxSnap = await getSheetSnapshot(auth, SHEET_TAB_JEUX);
		const allGames = await db.select().from(table.game);
		const gameMap = new Map(allGames.map((g) => [g.id, g]));
		const translatorMap = new Map(translators.map((t) => [t.id, t]));

		const updates: Array<{ range: string; values: string[][] }> = [];
		const appends: string[][] = [];
		for (const tr of translations) {
			try {
				const game = gameMap.get(tr.gameId);
				if (!game) continue;
				const translator = tr.translatorId ? (translatorMap.get(tr.translatorId) ?? null) : null;
				const proofreader = tr.proofreaderId ? (translatorMap.get(tr.proofreaderId) ?? null) : null;
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
			} catch (err) {
				errors.push(
					`translation ${tr.id}: ${err instanceof Error ? err.message : 'erreur inconnue'}`
				);
			}
		}
		for (let i = 0; i < updates.length; i += 200) {
			await sheetsBatchUpdate(auth, updates.slice(i, i + 200));
		}
		if (appends.length > 0) {
			for (let i = 0; i < appends.length; i += 500) {
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
	} catch (err) {
		errors.push(`bulk Jeux: ${err instanceof Error ? err.message : 'erreur inconnue'}`);
	}

	try {
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
		for (let i = 0; i < updates.length; i += 200) {
			await sheetsBatchUpdate(auth, updates.slice(i, i + 200));
		}
		if (appends.length > 0) {
			for (let i = 0; i < appends.length; i += 500) {
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
	} catch (err) {
		errors.push(
			`bulk Traducteurs/Relecteurs: ${err instanceof Error ? err.message : 'erreur inconnue'}`
		);
	}

	return {
		totalTranslations: translations.length,
		totalTranslators: translators.length,
		syncedTranslations: translations.length,
		syncedTranslators: translators.length,
		errors
	};
}
