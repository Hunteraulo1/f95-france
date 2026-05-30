import tags from '$lib/assets/f95-tags.json';
import { getGameEngineLabel } from '$lib/utils/game-engine-colors';
import { GAME_ENGINE_SELECT_VALUES } from '$lib/utils/game-translation-labels';

export type GamesFilterValueState = {
	value: string;
	label: string;
	checked: boolean;
	inverse: boolean;
};

export type GamesFilterGroupState = {
	title: string;
	name: string;
	values: GamesFilterValueState[];
};

export type SavedGamesFilterPreset = {
	query: string;
	sort: string;
	groups: GamesFilterGroupState[];
};

export const SAVED_GAMES_FILTERS_KEY = 'f95-france-saved-games-filters';
export const MAX_SAVED_GAMES_FILTERS = 5;
export const GAMES_VIEW_MODE_KEY = 'f95-france-games-view-mode';

export type GamesListViewMode = 'grid' | 'list';

const SITE_OPTIONS = [
	{ value: 'f95z', label: 'F95z' },
	{ value: 'lc', label: 'LewdCorner' },
	{ value: 'other', label: 'Autre' }
] as const;

const VERSION_OPTIONS = [
	{ value: 'up_to_date', label: 'À jour' },
	{ value: 'integrated', label: 'Intégrée' },
	{ value: 'outdated', label: 'Pas à jour' }
] as const;

const TYPE_OPTIONS = GAME_ENGINE_SELECT_VALUES.map((value) => ({
	value,
	label: getGameEngineLabel(value)
}));

const STATUS_OPTIONS = [
	{ value: 'in_progress', label: 'EN COURS' },
	{ value: 'abandoned', label: 'ABANDONNÉ' },
	{ value: 'completed', label: 'TERMINÉ' }
] as const;

const TTYPE_OPTIONS = [
	{ value: 'manual', label: 'Traduction Humaine' },
	{ value: 'auto', label: 'Traduction Automatique' },
	{ value: 'semi-auto', label: 'Traduction Semi-Automatique' },
	{ value: 'vf', label: 'VO Française' },
	{ value: 'to_tested', label: 'À tester' },
	{ value: 'hs', label: 'Lien Trad HS' }
] as const;

export const GAMES_FILTER_GROUP_NAMES = [
	'site',
	'version',
	'type',
	'status',
	'ttype',
	'traductor',
	'tags'
] as const;

export type GamesFilterGroupName = (typeof GAMES_FILTER_GROUP_NAMES)[number];

/** @internal Réutilisé par les filtres mises à jour. */
export function optionValuesFromOptions(
	options: readonly { value: string; label: string }[]
): GamesFilterValueState[] {
	return options.map((o) => ({
		value: o.value,
		label: o.label,
		checked: false,
		inverse: false
	}));
}

function optionValues(
	options: readonly { value: string; label: string }[]
): GamesFilterValueState[] {
	return optionValuesFromOptions(options);
}

/** Groupes de filtres (structure alignée sur l’extension f95list). */
export function createDefaultGamesFilterGroups(
	translators: { id: string; name: string }[] = []
): GamesFilterGroupState[] {
	return [
		{ title: 'Site', name: 'site', values: optionValues(SITE_OPTIONS) },
		{ title: 'Status de la traduction', name: 'version', values: optionValues(VERSION_OPTIONS) },
		{ title: 'Type', name: 'type', values: optionValues(TYPE_OPTIONS) },
		{ title: 'Status', name: 'status', values: optionValues(STATUS_OPTIONS) },
		{ title: 'Qualité de la traduction', name: 'ttype', values: optionValues(TTYPE_OPTIONS) },
		{
			title: 'Traducteur',
			name: 'traductor',
			values: translators.map((t) => ({
				value: t.id,
				label: t.name || 'Sans nom',
				checked: false,
				inverse: false
			}))
		},
		{
			title: 'Tags',
			name: 'tags',
			values: (tags as string[]).map((tag) => ({
				value: tag,
				label: tag,
				checked: false,
				inverse: false
			}))
		}
	];
}

export function cloneGamesFilterGroups(groups: GamesFilterGroupState[]): GamesFilterGroupState[] {
	return groups.map((g) => ({
		...g,
		values: g.values.map((v) => ({ ...v }))
	}));
}
