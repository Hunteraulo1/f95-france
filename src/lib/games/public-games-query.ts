import { getGameEngineLabel } from '$lib/utils/game-engine-colors';
import { GAME_ENGINE_SELECT_VALUES } from '$lib/utils/game-translation-labels';

export const PUBLIC_GAMES_SORT_OPTIONS = [
	{ value: 'updated_desc', label: 'Mise à jour (récent)' },
	{ value: 'updated_asc', label: 'Mise à jour (ancien)' },
	{ value: 'name_asc', label: 'Nom (A → Z)' },
	{ value: 'name_desc', label: 'Nom (Z → A)' }
] as const;

export type PublicGamesSort = (typeof PUBLIC_GAMES_SORT_OPTIONS)[number]['value'];

export const PUBLIC_GAMES_WEBSITE_OPTIONS = [
	{ value: '', label: 'Toutes les plateformes' },
	{ value: 'f95z', label: 'F95Zone' },
	{ value: 'lc', label: 'LewdCorner' },
	{ value: 'other', label: 'Autre' }
] as const;

export const PUBLIC_GAMES_STATUS_OPTIONS = [
	{ value: '', label: 'Tous les statuts' },
	{ value: 'completed', label: 'Traduction terminée' },
	{ value: 'in_progress', label: 'Traduction en cours' },
	{ value: 'abandoned', label: 'Traduction abandonnée' },
	{ value: 'none', label: 'Sans traduction' }
] as const;

export type PublicGamesTranslationStatus = '' | 'completed' | 'in_progress' | 'abandoned' | 'none';

export const PUBLIC_GAMES_ENGINE_OPTIONS = [
	{ value: '', label: 'Tous les moteurs' },
	...GAME_ENGINE_SELECT_VALUES.map((value) => ({
		value,
		label: getGameEngineLabel(value)
	}))
] as const;

const SORT_VALUES: readonly string[] = PUBLIC_GAMES_SORT_OPTIONS.map((o) => o.value);
const WEBSITE_VALUES: readonly string[] = ['f95z', 'lc', 'other'];
const STATUS_VALUES: readonly string[] = ['completed', 'in_progress', 'abandoned', 'none'];
const ENGINE_VALUES: readonly string[] = [...GAME_ENGINE_SELECT_VALUES];

export type PublicGamesQuery = {
	page: number;
	query: string;
	website: string;
	engine: string;
	status: PublicGamesTranslationStatus;
	sort: PublicGamesSort;
};

export function parsePublicGamesQuery(searchParams: URLSearchParams): PublicGamesQuery {
	const pageRaw = Number.parseInt(searchParams.get('page') ?? '1', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	const sortRaw = searchParams.get('sort')?.trim() ?? 'updated_desc';
	const sort = SORT_VALUES.includes(sortRaw) ? (sortRaw as PublicGamesSort) : 'updated_desc';

	const websiteRaw = searchParams.get('website')?.trim() ?? '';
	const website = WEBSITE_VALUES.includes(websiteRaw) ? websiteRaw : '';

	const statusRaw = searchParams.get('status')?.trim() ?? '';
	const status = STATUS_VALUES.includes(statusRaw)
		? (statusRaw as PublicGamesTranslationStatus)
		: '';

	const engineRaw = searchParams.get('engine')?.trim() ?? '';
	const engine = ENGINE_VALUES.includes(engineRaw) ? engineRaw : '';

	return {
		page,
		query: searchParams.get('q')?.trim() ?? '',
		website,
		engine,
		status,
		sort
	};
}

export function hasActivePublicGamesFilters(query: PublicGamesQuery): boolean {
	return Boolean(
		query.query || query.website || query.engine || query.status || query.sort !== 'updated_desc'
	);
}

export function buildPublicGamesSearchParams(
	query: PublicGamesQuery,
	overrides: Partial<PublicGamesQuery> = {}
): URLSearchParams {
	const merged = { ...query, ...overrides };
	const params = new URLSearchParams();

	if (merged.query) params.set('q', merged.query);
	if (merged.website) params.set('website', merged.website);
	if (merged.engine) params.set('engine', merged.engine);
	if (merged.status) params.set('status', merged.status);
	if (merged.sort && merged.sort !== 'updated_desc') params.set('sort', merged.sort);
	if (merged.page > 1) params.set('page', String(merged.page));

	return params;
}
