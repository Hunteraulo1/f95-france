/** Alignement version fiche jeu / traductions auto-check avec la réponse du checker F95. */

export type AcTranslationVersionRow = {
	ac: boolean;
	version: string | null;
};

export function normalizeCheckerVersion(raw: string | null | undefined): string | null {
	if (raw == null || raw === 'Unknown') return null;
	const trimmed = raw.trim();
	return trimmed.length > 0 ? trimmed : null;
}

/**
 * True si la version checker est connue, égale à la version jeu,
 * et aucune traduction auto-check n’a une version de référence différente.
 */
export function isF95CheckerVersionAligned(
	checkerVersion: string | null | undefined,
	gameVersion: string | null | undefined,
	translations: AcTranslationVersionRow[]
): boolean {
	const next = normalizeCheckerVersion(checkerVersion);
	if (!next) return false;
	if ((gameVersion ?? '').trim() !== next) return false;
	for (const t of translations) {
		if (!t.ac) continue;
		const rowV = (t.version ?? '').trim();
		if (rowV !== '' && rowV !== next) return false;
	}
	return true;
}

/** True si le checker signale une version différente (bump nécessaire). */
export function needsF95VersionBump(
	checkerVersion: string | null | undefined,
	gameVersion: string | null | undefined,
	translations: AcTranslationVersionRow[]
): boolean {
	const next = normalizeCheckerVersion(checkerVersion);
	if (!next) return false;
	if ((gameVersion ?? '').trim() !== next) return true;
	for (const t of translations) {
		if (!t.ac) continue;
		const rowV = (t.version ?? '').trim();
		if (rowV !== '' && rowV !== next) return true;
	}
	return false;
}
