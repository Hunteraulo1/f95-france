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

function parsePresets(raw: string | null | undefined): SavedGamesFilterPreset[] {
	if (!raw || !raw.trim()) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.map(normalizePreset)
			.filter((v): v is SavedGamesFilterPreset => v !== null)
			.slice(0, MAX_SAVED_GAMES_FILTERS);
	} catch {
		return [];
	}
}

function serializePresets(input: unknown): string {
	const presets = Array.isArray(input)
		? input.map(normalizePreset).filter((v): v is SavedGamesFilterPreset => v !== null)
		: [];
	return JSON.stringify(presets.slice(0, MAX_SAVED_GAMES_FILTERS));
}

export const parseSavedGamesFilters = parsePresets;
export const serializeSavedGamesFilters = serializePresets;
export const parseSavedUpdatesFilters = parsePresets;
export const serializeSavedUpdatesFilters = serializePresets;
