import {
	GAMES_FILTER_GROUP_NAMES,
	type GamesFilterGroupName,
	type GamesFilterGroupState
} from '$lib/games/games-filter-config';
import {
	applySelectionsToFilterGroups,
	cloneFilterGroups,
	type FilterSelection
} from '$lib/games/games-filter-url';
import { createDefaultUpdatesFilterGroups } from '$lib/updates/updates-filter-config';

export type UpdatesFilterGroupName = 'update_type' | GamesFilterGroupName;

export const UPDATES_FILTER_GROUP_NAMES = ['update_type', ...GAMES_FILTER_GROUP_NAMES] as const;

export type PublicUpdatesListParams = {
	page: number;
	query: string;
	filters: Record<UpdatesFilterGroupName, FilterSelection>;
};

function emptySelections(): Record<UpdatesFilterGroupName, FilterSelection> {
	return {
		update_type: { includes: [], excludes: [] },
		site: { includes: [], excludes: [] },
		version: { includes: [], excludes: [] },
		type: { includes: [], excludes: [] },
		status: { includes: [], excludes: [] },
		ttype: { includes: [], excludes: [] },
		traductor: { includes: [], excludes: [] },
		tags: { includes: [], excludes: [] }
	};
}

function parseListParam(raw: string | null): string[] {
	if (!raw?.trim()) return [];
	return raw
		.split(',')
		.map((v) => decodeURIComponent(v.trim()))
		.filter(Boolean);
}

export function parsePublicUpdatesListParams(
	searchParams: URLSearchParams
): PublicUpdatesListParams {
	const pageRaw = Number.parseInt(searchParams.get('page') ?? '1', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	const filters = emptySelections();

	for (const name of UPDATES_FILTER_GROUP_NAMES) {
		filters[name].includes = parseListParam(searchParams.get(name));
		filters[name].excludes = parseListParam(searchParams.get(`x_${name}`));
	}

	return {
		page,
		query: searchParams.get('q')?.trim() ?? '',
		filters
	};
}

export function buildPublicUpdatesListSearchParams(params: {
	query: string;
	sort?: string;
	page?: number;
	filters: Record<string, FilterSelection>;
}): URLSearchParams {
	const search = new URLSearchParams();

	if (params.query) search.set('q', params.query);
	if (params.page && params.page > 1) search.set('page', String(params.page));

	for (const name of UPDATES_FILTER_GROUP_NAMES) {
		const sel = params.filters[name] ?? { includes: [], excludes: [] };
		if (sel.includes.length) {
			search.set(name, sel.includes.map((v) => encodeURIComponent(v)).join(','));
		}
		if (sel.excludes.length) {
			search.set(`x_${name}`, sel.excludes.map((v) => encodeURIComponent(v)).join(','));
		}
	}

	return search;
}

export function buildUpdatesFilterGroupsForUi(
	params: PublicUpdatesListParams,
	translators: { id: string; name: string }[]
): GamesFilterGroupState[] {
	const base = createDefaultUpdatesFilterGroups(translators);
	return applySelectionsToFilterGroups(base, params.filters);
}

export function hasActivePublicUpdatesListFilters(params: PublicUpdatesListParams): boolean {
	if (params.query) return true;

	return UPDATES_FILTER_GROUP_NAMES.some(
		(name) => params.filters[name].includes.length > 0 || params.filters[name].excludes.length > 0
	);
}

export function cloneUpdatesFilterGroups(groups: GamesFilterGroupState[]): GamesFilterGroupState[] {
	return cloneFilterGroups(groups);
}

export { filterGroupsToSelections } from '$lib/games/games-filter-url';
