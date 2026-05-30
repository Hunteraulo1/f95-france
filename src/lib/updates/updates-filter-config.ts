import {
	createDefaultGamesFilterGroups,
	optionValuesFromOptions,
	type GamesFilterGroupState
} from '$lib/games/games-filter-config';

const UPDATE_TYPE_OPTIONS = [
	{ value: 'adding', label: 'Ajout de jeu' },
	{ value: 'update', label: 'Mise à jour' }
] as const;

export const SAVED_UPDATES_FILTERS_KEY = 'f95-france-saved-updates-filters';

/** Groupes de filtres mises à jour : type d’événement + filtres jeux (extension f95list). */
export function createDefaultUpdatesFilterGroups(
	translators: { id: string; name: string }[] = []
): GamesFilterGroupState[] {
	return [
		{
			title: 'Type de mise à jour',
			name: 'update_type',
			values: optionValuesFromOptions(UPDATE_TYPE_OPTIONS)
		},
		...createDefaultGamesFilterGroups(translators)
	];
}
