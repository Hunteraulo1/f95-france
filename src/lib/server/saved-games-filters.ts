import {
	MAX_SAVED_GAMES_FILTERS,
	type SavedGamesFilterPreset
} from '$lib/games/games-filter-config';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function normalizePreset(value: unknown): SavedGamesFilterPreset | null {
	if (!isRecord(value)) return null;
	const query = typeof value.query === 'string' ? value.query.trim().slice(0, 200) : '';
	const sort = typeof value.sort === 'string' ? value.sort : 'updated_desc';
	const groups = Array.isArray(value.groups) ? value.groups : [];
	return { query, sort, groups } as SavedGamesFilterPreset;
}

/** Parse une chaîne JSON depuis la DB vers des presets valides. */
export function parseSavedGamesFilters(raw: string | null | undefined): SavedGamesFilterPreset[] {
	if (!raw || !raw.trim()) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		const normalized = parsed
			.map(normalizePreset)
			.filter((v): v is SavedGamesFilterPreset => v !== null);
		return normalized.slice(0, MAX_SAVED_GAMES_FILTERS);
	} catch {
		return [];
	}
}

/** Nettoie puis sérialise les presets avant sauvegarde en base. */
export function serializeSavedGamesFilters(input: unknown): string {
	const presets = Array.isArray(input)
		? input.map(normalizePreset).filter((v): v is SavedGamesFilterPreset => v !== null)
		: [];
	return JSON.stringify(presets.slice(0, MAX_SAVED_GAMES_FILTERS));
}
