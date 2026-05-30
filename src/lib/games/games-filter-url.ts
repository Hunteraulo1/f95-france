import {
	cloneGamesFilterGroups,
	createDefaultGamesFilterGroups,
	GAMES_FILTER_GROUP_NAMES,
	type GamesFilterGroupName,
	type GamesFilterGroupState
} from '$lib/games/games-filter-config';
import { PUBLIC_GAMES_SORT_OPTIONS, type PublicGamesSort } from '$lib/games/public-games-query';

export type FilterSelection = {
	includes: string[];
	excludes: string[];
};

export type PublicGamesListParams = {
	page: number;
	query: string;
	sort: PublicGamesSort;
	filters: Record<GamesFilterGroupName, FilterSelection>;
};

const SORT_VALUES: readonly string[] = PUBLIC_GAMES_SORT_OPTIONS.map((o) => o.value);

function emptySelections(): Record<GamesFilterGroupName, FilterSelection> {
	return {
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

export function parsePublicGamesListParams(searchParams: URLSearchParams): PublicGamesListParams {
	const pageRaw = Number.parseInt(searchParams.get('page') ?? '1', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	const sortRaw = searchParams.get('sort')?.trim() ?? 'updated_desc';
	const sort = SORT_VALUES.includes(sortRaw) ? (sortRaw as PublicGamesSort) : 'updated_desc';

	const filters = emptySelections();

	for (const name of GAMES_FILTER_GROUP_NAMES) {
		filters[name].includes = parseListParam(searchParams.get(name));
		filters[name].excludes = parseListParam(searchParams.get(`x_${name}`));
	}

	// Anciens paramètres (une seule valeur)
	const legacyWebsite = searchParams.get('website')?.trim();
	if (legacyWebsite && filters.site.includes.length === 0) {
		filters.site.includes = [legacyWebsite];
	}
	const legacyEngine = searchParams.get('engine')?.trim();
	if (legacyEngine && filters.type.includes.length === 0) {
		filters.type.includes = [legacyEngine];
	}
	const legacyStatus = searchParams.get('status')?.trim();
	if (legacyStatus && legacyStatus !== 'none' && filters.status.includes.length === 0) {
		filters.status.includes = [legacyStatus];
	}

	return {
		page,
		query: searchParams.get('q')?.trim() ?? '',
		sort,
		filters
	};
}

export function applySelectionsToFilterGroups(
	groups: GamesFilterGroupState[],
	selections: Record<string, FilterSelection>
): GamesFilterGroupState[] {
	return groups.map((group) => {
		const sel = selections[group.name];
		if (!sel) return group;

		return {
			...group,
			values: group.values.map((v) => {
				const included = sel.includes.includes(v.value);
				const excluded = sel.excludes.includes(v.value);
				return {
					...v,
					checked: included || excluded,
					inverse: excluded
				};
			})
		};
	});
}

export function filterGroupsToSelections(
	groups: GamesFilterGroupState[]
): Record<string, FilterSelection> {
	const out: Record<string, FilterSelection> = {};

	for (const group of groups) {
		out[group.name] = { includes: [], excludes: [] };
	}

	for (const group of groups) {
		for (const v of group.values) {
			if (!v.checked) continue;
			if (v.inverse) out[group.name].excludes.push(v.value);
			else out[group.name].includes.push(v.value);
		}
	}

	return out;
}

export function buildPublicGamesListSearchParams(params: {
	query: string;
	sort: string;
	page?: number;
	filters: Record<string, FilterSelection>;
}): URLSearchParams {
	const search = new URLSearchParams();

	if (params.query) search.set('q', params.query);
	if (params.sort && params.sort !== 'updated_desc') search.set('sort', params.sort);
	if (params.page && params.page > 1) search.set('page', String(params.page));

	for (const name of GAMES_FILTER_GROUP_NAMES) {
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

export function buildFilterGroupsForUi(
	params: PublicGamesListParams,
	translators: { id: string; name: string }[]
): GamesFilterGroupState[] {
	const base = createDefaultGamesFilterGroups(translators);
	return applySelectionsToFilterGroups(base, params.filters);
}

export function hasActivePublicGamesListFilters(params: PublicGamesListParams): boolean {
	if (params.query) return true;
	if (params.sort !== 'updated_desc') return true;

	return GAMES_FILTER_GROUP_NAMES.some(
		(name) => params.filters[name].includes.length > 0 || params.filters[name].excludes.length > 0
	);
}

export function cloneFilterGroups(groups: GamesFilterGroupState[]): GamesFilterGroupState[] {
	return cloneGamesFilterGroups(groups);
}
