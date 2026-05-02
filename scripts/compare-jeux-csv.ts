/**
 * Compare deux exports CSV de la feuille « Jeux » (legacy vs nouveau).
 * Usage : pnpm sheet:diff-jeux -- chemin/legacy.csv chemin/nouveau.csv
 *
 * Évite le bruit d’un diff texte : alignement sur identifiant (ID DB / Id Db / colonne « ID » exacte
 * côté ancien sheet), sinon Nom du jeu + Lien Trad (ou + Trad. Ver.).
 * Ex. ancien : … | ID | … | AC | IMAGE  —  nouveau : … | ID DB  (mêmes UUID si la sync a été faite).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

function normalizeHeader(raw: string): string {
	return raw
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** Même logique que google-sheets-sync (exact puis match inclusif). */
function findHeaderIndex(headersRow: string[], candidates: string[]): number {
	const normalizedHeaders = headersRow.map((h) => normalizeHeader(h ?? ''));
	const normalizedCandidates = candidates.map((c) => normalizeHeader(c));
	for (const cand of normalizedCandidates) {
		const i = normalizedHeaders.findIndex((h) => h === cand);
		if (i !== -1) return i;
	}
	for (const cand of normalizedCandidates) {
		const i = normalizedHeaders.findIndex((h) => h.includes(cand) || cand.includes(h));
		if (i !== -1) return i;
	}
	return -1;
}

/**
 * Identifiant de ligne (UUID traduction). Match **exact** sur « id » / « id db » après normalisation,
 * pour ne pas confondre avec des en-têtes du type « video » (sous-chaîne « id »).
 */
function findRowIdColumnIndex(headers: string[]): number {
	const nh = headers.map((h) => normalizeHeader(h ?? ''));
	let i = nh.findIndex((h) => h === 'id db');
	if (i !== -1) return i;
	i = nh.findIndex((h) => h === 'id');
	if (i !== -1) return i;
	i = nh.findIndex((h) => h.includes('id db'));
	return i;
}

function rowIdKeyLabel(legacyH: string[], newH: string[], legacyIdx: number, newIdx: number): string {
	const a = (legacyH[legacyIdx] ?? '').trim() || 'ID';
	const b = (newH[newIdx] ?? '').trim() || 'ID DB';
	if (normalizeHeader(a) === normalizeHeader(b)) return a;
	return `${a} (ancien) ↔ ${b} (nouveau)`;
}

type KeyConfig =
	| { kind: 'single'; legacyIdx: number; newIdx: number; label: string }
	| { kind: 'composite'; legacyIdx: number[]; newIdx: number[]; label: string };

type KeyMode = 'auto' | 'id' | 'lien' | 'tradver';

function resolveCompositeKeyConfig(legacyH: string[], newH: string[]): KeyConfig | null {
	const nomL = findHeaderIndex(legacyH, ['Nom du jeu', 'Jeu']);
	const nomN = findHeaderIndex(newH, ['Nom du jeu', 'Jeu']);
	const lienL = findHeaderIndex(legacyH, ['Lien Trad', 'Lien traduction']);
	const lienN = findHeaderIndex(newH, ['Lien Trad', 'Lien traduction']);
	if (nomL !== -1 && nomN !== -1 && lienL !== -1 && lienN !== -1) {
		return {
			kind: 'composite',
			legacyIdx: [nomL, lienL],
			newIdx: [nomN, lienN],
			label: 'Nom du jeu + Lien Trad'
		};
	}

	const tvL = findHeaderIndex(legacyH, [
		'Trad. Ver.',
		'Trad Ver',
		'TRAD. VER.',
		'Version trad',
		'Version traduction'
	]);
	const tvN = findHeaderIndex(newH, [
		'Trad. Ver.',
		'Trad Ver',
		'TRAD. VER.',
		'Version trad',
		'Version traduction'
	]);
	if (nomL !== -1 && nomN !== -1 && tvL !== -1 && tvN !== -1) {
		return {
			kind: 'composite',
			legacyIdx: [nomL, tvL],
			newIdx: [nomN, tvN],
			label: 'Nom du jeu + Trad. Ver.'
		};
	}

	return null;
}

function resolveLienKeyConfig(legacyH: string[], newH: string[]): KeyConfig | null {
	const nomL = findHeaderIndex(legacyH, ['Nom du jeu', 'Jeu']);
	const nomN = findHeaderIndex(newH, ['Nom du jeu', 'Jeu']);
	const lienL = findHeaderIndex(legacyH, ['Lien Trad', 'Lien traduction']);
	const lienN = findHeaderIndex(newH, ['Lien Trad', 'Lien traduction']);
	if (nomL !== -1 && nomN !== -1 && lienL !== -1 && lienN !== -1) {
		return {
			kind: 'composite',
			legacyIdx: [nomL, lienL],
			newIdx: [nomN, lienN],
			label: 'Nom du jeu + Lien Trad'
		};
	}
	return null;
}

function resolveTradVerKeyConfig(legacyH: string[], newH: string[]): KeyConfig | null {
	const nomL = findHeaderIndex(legacyH, ['Nom du jeu', 'Jeu']);
	const nomN = findHeaderIndex(newH, ['Nom du jeu', 'Jeu']);
	const tvL = findHeaderIndex(legacyH, [
		'Trad. Ver.',
		'Trad Ver',
		'TRAD. VER.',
		'Version trad',
		'Version traduction'
	]);
	const tvN = findHeaderIndex(newH, [
		'Trad. Ver.',
		'Trad Ver',
		'TRAD. VER.',
		'Version trad',
		'Version traduction'
	]);
	if (nomL !== -1 && nomN !== -1 && tvL !== -1 && tvN !== -1) {
		return {
			kind: 'composite',
			legacyIdx: [nomL, tvL],
			newIdx: [nomN, tvN],
			label: 'Nom du jeu + Trad. Ver.'
		};
	}
	return null;
}

function resolveIdKeyConfig(legacyH: string[], newH: string[]): KeyConfig | null {
	const idL = findRowIdColumnIndex(legacyH);
	const idN = findRowIdColumnIndex(newH);
	if (idL !== -1 && idN !== -1) {
		return {
			kind: 'single',
			legacyIdx: idL,
			newIdx: idN,
			label: rowIdKeyLabel(legacyH, newH, idL, idN)
		};
	}
	return null;
}

function resolveKeyConfig(legacyH: string[], newH: string[], keyMode: KeyMode): KeyConfig | null {
	if (keyMode === 'id') return resolveIdKeyConfig(legacyH, newH);
	if (keyMode === 'lien') return resolveLienKeyConfig(legacyH, newH);
	if (keyMode === 'tradver') return resolveTradVerKeyConfig(legacyH, newH);
	const id = resolveIdKeyConfig(legacyH, newH);
	if (id) return id;
	return resolveCompositeKeyConfig(legacyH, newH);
}

type KeyShape = 'uuid' | 'numeric' | 'mixed' | 'empty';

function inferKeyShape(rows: string[][], idx: number): KeyShape {
	let nonEmpty = 0;
	let uuidCount = 0;
	let numericCount = 0;
	for (let r = 1; r < rows.length && nonEmpty < 250; r++) {
		const raw = (rows[r]?.[idx] ?? '').trim();
		if (!raw) continue;
		nonEmpty++;
		if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
			uuidCount++;
			continue;
		}
		if (/^\d+$/.test(raw)) numericCount++;
	}
	if (nonEmpty === 0) return 'empty';
	if (uuidCount === nonEmpty) return 'uuid';
	if (numericCount === nonEmpty) return 'numeric';
	return 'mixed';
}

function buildRowMapForFile(rows: string[][], colIndices: number[]): {
	map: Map<string, string[]>;
	dupes: string[];
} {
	const map = new Map<string, string[]>();
	const dupes: string[] = [];
	const sep = '\x1e';
	for (let r = 1; r < rows.length; r++) {
		const row = rows[r];
		if (!row) continue;
		const parts = colIndices.map((i) => (row[i] ?? '').trim());
		if (parts.every((p) => !p)) continue;
		const key = parts.join(sep);
		if (map.has(key)) dupes.push(key);
		map.set(key, row);
	}
	return { map, dupes };
}

function formatKeyForDisplay(key: string): string {
	return key.includes('\x1e') ? key.split('\x1e').join(' │ ') : key;
}

function parseCsv(content: string): string[][] {
	const text = content.replace(/^\uFEFF/, '');
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let i = 0;
	let inQuotes = false;

	while (i < text.length) {
		const c = text[i]!;
		if (inQuotes) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i += 2;
					continue;
				}
				inQuotes = false;
				i++;
				continue;
			}
			field += c;
			i++;
			continue;
		}
		if (c === '"') {
			inQuotes = true;
			i++;
			continue;
		}
		if (c === ',') {
			row.push(field);
			field = '';
			i++;
			continue;
		}
		if (c === '\r') {
			i++;
			continue;
		}
		if (c === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
			i++;
			continue;
		}
		field += c;
		i++;
	}
	row.push(field);
	if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
		rows.push(row);
	}
	return rows;
}

function parseArgs(argv: string[]): {
	legacyPath?: string;
	newPath?: string;
	reportPath?: string;
	pruneNewPath?: string;
	keyMode: KeyMode;
} {
	const args = argv.slice(2).filter((a) => a !== '--');
	let reportPath: string | undefined;
	let pruneNewPath: string | undefined;
	let keyMode: KeyMode = 'auto';
	const positional: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const a = args[i]!;
		if (a === '--report' || a === '-r') {
			reportPath = args[i + 1];
			i++;
			continue;
		}
		if (a === '--prune-new') {
			pruneNewPath = args[i + 1];
			i++;
			continue;
		}
		if (a === '--key' || a === '-k') {
			const mode = (args[i + 1] ?? '').toLowerCase();
			if (mode === 'auto' || mode === 'id' || mode === 'lien' || mode === 'tradver') {
				keyMode = mode;
			}
			i++;
			continue;
		}
		positional.push(a);
	}
	return { legacyPath: positional[0], newPath: positional[1], reportPath, pruneNewPath, keyMode };
}

function escapeCsvField(value: string): string {
	if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
	return value;
}

function rowsToCsv(rows: string[][]): string {
	return rows.map((row) => row.map((c) => escapeCsvField(c ?? '')).join(',')).join('\n');
}

/**
 * Aligné sur `formatGameType` (google-sheets-sync) : faute « HTLM » = HTML.
 * Comparaison insensible à la casse pour les libellés exportés (RenPy, etc.).
 */
function normalizeGameTypeCellForCompare(raw: string): string {
	let v = raw.trim().toLowerCase();
	if (v === 'htlm') v = 'html';
	return v;
}

/** Deux cellules sont considérées égales pour le diff (évite le bruit métier). */
function cellsEquivalent(columnNorm: string, va: string, vb: string): boolean {
	const a = va.trim();
	const b = vb.trim();
	if (a === b) return true;
	if (columnNorm === 'type') {
		return normalizeGameTypeCellForCompare(a) === normalizeGameTypeCellForCompare(b);
	}
	return false;
}

function buildHeaderMaps(headers: string[]) {
	const indexByNorm = new Map<string, number>();
	const labelByNorm = new Map<string, string>();
	for (let i = 0; i < headers.length; i++) {
		const n = normalizeHeader(headers[i] ?? '');
		if (!n) continue;
		if (!indexByNorm.has(n)) {
			indexByNorm.set(n, i);
			labelByNorm.set(n, (headers[i] ?? '').trim() || n);
		}
	}
	return { indexByNorm, labelByNorm };
}

function main() {
	const { legacyPath, newPath, reportPath, pruneNewPath, keyMode } = parseArgs(process.argv);
	if (!legacyPath || !newPath) {
		console.error(
			'Usage: pnpm sheet:diff-jeux -- <legacy.csv> <nouveau.csv> [--key auto|id|lien|tradver] [--report <fichier.md>] [--prune-new <sortie.csv>]\n' +
				'  --prune-new : écrit un CSV « nouveau » sans les lignes dont la clé n’existe pas côté legacy.\n' +
				'  (ex. tsx scripts/compare-jeux-csv.ts legacy.csv nouveau.csv --key tradver --prune-new nouveau-epure.csv)'
		);
		process.exit(2);
	}

	const legacyRows = parseCsv(readFileSync(legacyPath, 'utf8'));
	const newRows = parseCsv(readFileSync(newPath, 'utf8'));

	if (legacyRows.length === 0 || newRows.length === 0) {
		console.error('Un des fichiers CSV est vide.');
		process.exit(2);
	}

	const legacyH = legacyRows[0] ?? [];
	const newH = newRows[0] ?? [];
	let keyCfg = resolveKeyConfig(legacyH, newH, keyMode);
	if (!keyCfg) {
		console.error(
			'Impossible de déterminer une clé de ligne commune.\n' +
				'• Soit « ID DB » est présent dans les deux exports,\n' +
				'• soit les deux ont « Nom du jeu » + « Lien Trad » (ou + « Trad. Ver. »).\n' +
				'  (Si « ID DB » n’existe que dans le nouveau fichier, le legacy doit quand même avoir Nom + Lien Trad pour aligner les lignes.)\n' +
				`En-têtes legacy : ${legacyH.join(' | ')}\n` +
				`En-têtes nouveau : ${newH.join(' | ')}`
		);
		process.exit(2);
	}
	let forcedCompositeReason: string | null = null;
	if (keyCfg.kind === 'single' && keyMode === 'auto') {
		const legacyShape = inferKeyShape(legacyRows, keyCfg.legacyIdx);
		const newShape = inferKeyShape(newRows, keyCfg.newIdx);
		const incompatibleShapes =
			(legacyShape === 'numeric' && newShape === 'uuid') ||
			(legacyShape === 'uuid' && newShape === 'numeric');
		if (incompatibleShapes) {
			const composite = resolveCompositeKeyConfig(legacyH, newH);
			if (composite) {
				keyCfg = composite;
				forcedCompositeReason =
					`IDs incompatibles détectés (${legacyShape} côté legacy vs ${newShape} côté nouveau)`;
			}
		}
	}

	const legacyKeyIdx =
		keyCfg.kind === 'single' ? [keyCfg.legacyIdx] : keyCfg.legacyIdx;
	const newKeyIdx = keyCfg.kind === 'single' ? [keyCfg.newIdx] : keyCfg.newIdx;

	const L = buildHeaderMaps(legacyH);
	const N = buildHeaderMaps(newH);
	const commonNorms = [...L.indexByNorm.keys()].filter((k) => N.indexByNorm.has(k));
	const onlyLegacyNorms = [...L.indexByNorm.keys()].filter((k) => !N.indexByNorm.has(k));
	const onlyNewNorms = [...N.indexByNorm.keys()].filter((k) => !L.indexByNorm.has(k));

	const { map: legacyById, dupes: dupLegacy } = buildRowMapForFile(legacyRows, legacyKeyIdx);
	const { map: newById, dupes: dupNew } = buildRowMapForFile(newRows, newKeyIdx);

	const idsLegacy = new Set(legacyById.keys());
	const idsNew = new Set(newById.keys());
	const onlyLegacy = [...idsLegacy].filter((id) => !idsNew.has(id)).sort();
	const onlyNew = [...idsNew].filter((id) => !idsLegacy.has(id)).sort();
	const both = [...idsLegacy].filter((id) => idsNew.has(id)).sort();

	if (pruneNewPath) {
		const prunedBody: string[][] = [];
		let dropped = 0;
		const sep = '\x1e';
		for (let r = 1; r < newRows.length; r++) {
			const row = newRows[r];
			if (!row) continue;
			const parts = newKeyIdx.map((i) => (row[i] ?? '').trim());
			if (parts.every((p) => !p)) {
				dropped++;
				continue;
			}
			const k = parts.join(sep);
			if (!legacyById.has(k)) {
				dropped++;
				continue;
			}
			prunedBody.push(row);
		}
		const prunedAll = [newH, ...prunedBody];
		writeFileSync(pruneNewPath, rowsToCsv(prunedAll), 'utf8');
		console.log(
			`\nFichier épuré écrit : ${pruneNewPath} (${prunedBody.length} lignes données, ${dropped} ligne(s) « seulement nouveau » retirée(s)).`
		);
	}

	const cellDiffs: string[] = [];
	const MAX_LINES = 400;

	for (const id of both) {
		const a = legacyById.get(id)!;
		const b = newById.get(id)!;
		for (const norm of commonNorms) {
			const li = L.indexByNorm.get(norm)!;
			const ni = N.indexByNorm.get(norm)!;
			const va = (a[li] ?? '').trim();
			const vb = (b[ni] ?? '').trim();
			if (!cellsEquivalent(norm, va, vb)) {
				const label = L.labelByNorm.get(norm) ?? norm;
				if (cellDiffs.length < MAX_LINES) {
					const k = formatKeyForDisplay(id);
					cellDiffs.push(
						`  [${k}] ${label}\n    legacy : ${truncate(va, 120)}\n    nouveau: ${truncate(vb, 120)}`
					);
				}
			}
		}
	}

	console.log('=== Comparaison feuille Jeux (CSV) ===\n');
	console.log(`Fichiers : ${basename(legacyPath)} ↔ ${basename(newPath)}\n`);
	console.log(`Mode de clé : ${keyMode}`);
	if (forcedCompositeReason) {
		console.log(`Note : ${forcedCompositeReason} ; bascule automatique sur clé composite.`);
	}
	console.log(`Clé de ligne : ${keyCfg.label}`);
	const idColLegacy = findRowIdColumnIndex(legacyH);
	const idColNew = findRowIdColumnIndex(newH);
	if (idColLegacy === -1 && idColNew !== -1) {
		console.log(
			'Note : « ID DB » seulement dans le fichier nouveau — appariement via la clé ci-dessus. ' +
				'« ID DB » n’est pas comparée au legacy (colonne absente) ; elle apparaît dans « colonnes seulement dans nouveau » si besoin.'
		);
	} else if (idColLegacy !== -1 && idColNew === -1) {
		console.log(
			'Note : « ID DB » seulement dans le fichier legacy — appariement via la clé ci-dessus ; pas de comparaison « ID DB » avec le nouveau.'
		);
	}
	console.log(`Lignes avec clé : legacy ${legacyById.size}, nouveau ${newById.size}`);
	console.log(`Colonnes appariées : ${commonNorms.length}`);
	if (onlyLegacyNorms.length) {
		console.log(
			`\nColonnes seulement dans legacy (${onlyLegacyNorms.length}) :`,
			onlyLegacyNorms.map((n) => L.labelByNorm.get(n)).join(', ')
		);
	}
	if (onlyNewNorms.length) {
		console.log(
			`\nColonnes seulement dans nouveau (${onlyNewNorms.length}) :`,
			onlyNewNorms.map((n) => N.labelByNorm.get(n)).join(', ')
		);
	}
	if (dupLegacy.length) {
		const sample = uniq(dupLegacy).slice(0, 20).map(formatKeyForDisplay);
		console.log(
			`\n⚠ Clés dupliquées dans legacy (première ligne gardée) : ${sample.join(' ; ')}${uniq(dupLegacy).length > 20 ? ' …' : ''}`
		);
	}
	if (dupNew.length) {
		const sample = uniq(dupNew).slice(0, 20).map(formatKeyForDisplay);
		console.log(
			`\n⚠ Clés dupliquées dans nouveau (première ligne gardée) : ${sample.join(' ; ')}${uniq(dupNew).length > 20 ? ' …' : ''}`
		);
	}

	if (onlyLegacy.length) {
		console.log(`\n--- Lignes seulement dans legacy (${onlyLegacy.length}) ---`);
		console.log(onlyLegacy.slice(0, 80).join(', ') + (onlyLegacy.length > 80 ? ' …' : ''));
	}
	if (onlyNew.length) {
		console.log(`\n--- Lignes seulement dans nouveau (${onlyNew.length}) ---`);
		console.log(onlyNew.slice(0, 80).join(', ') + (onlyNew.length > 80 ? ' …' : ''));
	}

	const totalCellIssues = countCellDiffs(both, legacyById, newById, commonNorms, L, N);
	if (cellDiffs.length) {
		console.log(`\n--- Cellules différentes (échantillon max ${MAX_LINES} lignes) ---`);
		console.log(cellDiffs.join('\n\n'));
		if (totalCellIssues > MAX_LINES) {
			console.log(`\n… et ${totalCellIssues - MAX_LINES} autre(s) différence(s) non affichée(s).`);
		}
	}

	const hasStructural = onlyLegacy.length > 0 || onlyNew.length > 0;
	const hasCells = totalCellIssues > 0;
	const hasColMismatch = onlyLegacyNorms.length > 0 || onlyNewNorms.length > 0;
	const idsWithDiffs = countIdsWithDiffs(both, legacyById, newById, commonNorms, L, N);

	if (reportPath) {
		const reportLines: string[] = [];
		reportLines.push('# Rapport de comparaison - feuille Jeux');
		reportLines.push('');
		reportLines.push(`- Fichiers: \`${basename(legacyPath)}\` vs \`${basename(newPath)}\``);
		reportLines.push(`- Mode de clé: ${keyMode}`);
		reportLines.push(`- Clé de ligne: ${keyCfg.label}`);
		if (forcedCompositeReason) {
			reportLines.push(`- Note: ${forcedCompositeReason}`);
		}
		reportLines.push(`- Lignes avec clé: legacy ${legacyById.size}, nouveau ${newById.size}`);
		reportLines.push(`- Colonnes appariées: ${commonNorms.length}`);
		reportLines.push('');
		reportLines.push('## Résumé');
		reportLines.push('');
		reportLines.push(`- Lignes seulement legacy: ${onlyLegacy.length}`);
		reportLines.push(`- Lignes seulement nouveau: ${onlyNew.length}`);
		reportLines.push(`- Cellules différentes (total): ${totalCellIssues}`);
		reportLines.push(`- Paires de lignes avec au moins une différence: ${idsWithDiffs}`);
		reportLines.push(
			`- Colonnes non communes: ${onlyLegacyNorms.length + onlyNewNorms.length}`
		);
		reportLines.push('');

		if (onlyLegacyNorms.length) {
			reportLines.push('## Colonnes seulement dans legacy');
			reportLines.push('');
			for (const n of onlyLegacyNorms) reportLines.push(`- ${L.labelByNorm.get(n) ?? n}`);
			reportLines.push('');
		}
		if (onlyNewNorms.length) {
			reportLines.push('## Colonnes seulement dans nouveau');
			reportLines.push('');
			for (const n of onlyNewNorms) reportLines.push(`- ${N.labelByNorm.get(n) ?? n}`);
			reportLines.push('');
		}
		if (dupLegacy.length) {
			reportLines.push('## Clés dupliquées dans legacy');
			reportLines.push('');
			for (const k of uniq(dupLegacy)) reportLines.push(`- \`${formatKeyForDisplay(k)}\``);
			reportLines.push('');
		}
		if (dupNew.length) {
			reportLines.push('## Clés dupliquées dans nouveau');
			reportLines.push('');
			for (const k of uniq(dupNew)) reportLines.push(`- \`${formatKeyForDisplay(k)}\``);
			reportLines.push('');
		}
		if (onlyLegacy.length) {
			reportLines.push('## Lignes seulement dans legacy');
			reportLines.push('');
			for (const id of onlyLegacy) reportLines.push(`- \`${formatKeyForDisplay(id)}\``);
			reportLines.push('');
		}
		if (onlyNew.length) {
			reportLines.push('## Lignes seulement dans nouveau');
			reportLines.push('');
			for (const id of onlyNew) reportLines.push(`- \`${formatKeyForDisplay(id)}\``);
			reportLines.push('');
		}
		if (totalCellIssues > 0) {
			reportLines.push('## Détails des cellules différentes');
			reportLines.push('');
			for (const id of both) {
				const a = legacyById.get(id)!;
				const b = newById.get(id)!;
				const rowDiffs: string[] = [];
				for (const norm of commonNorms) {
					const li = L.indexByNorm.get(norm)!;
					const ni = N.indexByNorm.get(norm)!;
					const va = (a[li] ?? '').trim();
					const vb = (b[ni] ?? '').trim();
					if (!cellsEquivalent(norm, va, vb)) {
						const label = L.labelByNorm.get(norm) ?? norm;
						rowDiffs.push(
							`- ${label}\n  - legacy: ${va || '(vide)'}\n  - nouveau: ${vb || '(vide)'}`
						);
					}
				}
				if (rowDiffs.length) {
					reportLines.push(`### ${formatKeyForDisplay(id)}`);
					reportLines.push('');
					reportLines.push(...rowDiffs);
					reportLines.push('');
				}
			}
		}

		writeFileSync(reportPath, reportLines.join('\n'), 'utf8');
		console.log(`\nRapport complet écrit dans : ${reportPath}`);
	}

	if (!hasStructural && !hasCells && !hasColMismatch) {
		console.log('\n✓ Aucune différence sur les lignes et colonnes communes.');
		process.exit(0);
	}

	console.log('\n--- Résumé ---');
	if (hasStructural) console.log(`Lignes manquantes d’un côté : ${onlyLegacy.length + onlyNew.length}`);
	if (hasCells)
		console.log(
			`Paires de lignes (même clé) avec au moins une cellule différente : ${idsWithDiffs}`
		);
	if (hasColMismatch) console.log('Colonnes non communes : voir ci-dessus.');

	process.exit(hasStructural || hasCells || hasColMismatch ? 1 : 0);
}

function truncate(s: string, n: number): string {
	if (s.length <= n) return s;
	return s.slice(0, n - 1) + '…';
}

function uniq<T>(arr: T[]): T[] {
	return [...new Set(arr)];
}

function countCellDiffs(
	both: string[],
	legacyById: Map<string, string[]>,
	newById: Map<string, string[]>,
	commonNorms: string[],
	L: ReturnType<typeof buildHeaderMaps>,
	N: ReturnType<typeof buildHeaderMaps>
): number {
	let n = 0;
	for (const id of both) {
		const a = legacyById.get(id)!;
		const b = newById.get(id)!;
		for (const norm of commonNorms) {
			const li = L.indexByNorm.get(norm)!;
			const ni = N.indexByNorm.get(norm)!;
			if (!cellsEquivalent(norm, (a[li] ?? '').trim(), (b[ni] ?? '').trim())) n++;
		}
	}
	return n;
}

function countIdsWithDiffs(
	both: string[],
	legacyById: Map<string, string[]>,
	newById: Map<string, string[]>,
	commonNorms: string[],
	L: ReturnType<typeof buildHeaderMaps>,
	N: ReturnType<typeof buildHeaderMaps>
): number {
	let ids = 0;
	for (const id of both) {
		const a = legacyById.get(id)!;
		const b = newById.get(id)!;
		let diff = false;
		for (const norm of commonNorms) {
			const li = L.indexByNorm.get(norm)!;
			const ni = N.indexByNorm.get(norm)!;
			if (!cellsEquivalent(norm, (a[li] ?? '').trim(), (b[ni] ?? '').trim())) {
				diff = true;
				break;
			}
		}
		if (diff) ids++;
	}
	return ids;
}

main();
