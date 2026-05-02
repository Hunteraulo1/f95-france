/** Règles partagées (webhooks updates / traducteurs, auto-check). */

export function strTrim(s: unknown): string {
	if (s == null) return '';
	return String(s).trim();
}

/** « Trad. Ver. » = libellé Intégrée, ou type de traduction intégrée en base. */
export function tradVerIndicatesIntegrated(tversion: unknown, tname: unknown): boolean {
	if (tname === 'integrated') return true;
	const tv = strTrim(tversion)
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '');
	return tv === 'integree';
}

/**
 * Auto-check : ping traducteur sauf intégrée / Trad. Ver. « Intégrée ».
 * Si `version === tversion` on ne skip que lorsque les deux valent déjà la version F95 (rien à faire).
 * Si elles sont égales mais fausses (ex. toutes deux en retard), on ping quand même.
 */
export function shouldNotifyTranslatorOnAutoCheckVersionBump(
	row: {
		version: string | null;
		tversion: string;
		tname: string;
	},
	checkerVersion: string
): boolean {
	if (tradVerIndicatesIntegrated(row.tversion, row.tname)) return false;
	const v = strTrim(row.version);
	const tv = strTrim(row.tversion);
	const f95 = strTrim(checkerVersion);
	if (v === tv) {
		if (f95 !== '' && v === f95) return false;
		return f95 !== '';
	}
	return true;
}
