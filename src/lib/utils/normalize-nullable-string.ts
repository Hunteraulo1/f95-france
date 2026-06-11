const EMPTY_DISPLAY_SENTINELS = new Set(['—', '–', '-']);

/** Valeurs vides ou placeholders d’affichage → `null` (ex. nom de traduction). */
export function normalizeNullableHistoryString(value: unknown): string | null {
	if (value == null) return null;
	const trimmed = String(value).trim();
	if (!trimmed) return null;
	if (EMPTY_DISPLAY_SENTINELS.has(trimmed)) return null;
	return trimmed;
}
