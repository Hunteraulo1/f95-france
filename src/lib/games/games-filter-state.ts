import type { GamesFilterGroupState, GamesFilterValueState } from '$lib/games/games-filter-config';

/** Logique de sélection (include / exclude) calquée sur FilterPopover de l’extension. */
export function toggleGamesFilterValue(
	groups: GamesFilterGroupState[],
	groupName: string,
	value: string
): GamesFilterGroupState[] {
	return groups.map((group) => {
		if (group.name !== groupName) return group;

		return {
			...group,
			values: group.values.map((entry) => {
				if (entry.value !== value) return entry;
				return nextFilterValueState(group, entry);
			})
		};
	});
}

function nextFilterValueState(
	group: GamesFilterGroupState,
	entry: GamesFilterValueState
): GamesFilterValueState {
	const isTags = group.name === 'tags';

	if (!isTags) {
		const others = group.values.filter((v) => v.value !== entry.value);

		if (others.some((v) => v.inverse)) {
			if (entry.inverse) return { ...entry, checked: false, inverse: false };
			return { ...entry, checked: true, inverse: true };
		}

		if (others.some((v) => v.checked)) {
			if (entry.checked) return { ...entry, checked: false, inverse: false };
			return { ...entry, checked: true, inverse: false };
		}
	}

	if (entry.inverse !== undefined) {
		if (!entry.checked) return { ...entry, checked: true, inverse: false };
		if (!entry.inverse) return { ...entry, checked: true, inverse: true };
		return { ...entry, checked: false, inverse: false };
	}

	return { ...entry, checked: !entry.checked };
}

export function gamesFilterGroupSummary(group: GamesFilterGroupState): string {
	const active = group.values.filter((v) => v.checked);
	if (active.length === 0) return `Filtrer par ${group.title}`;

	return active.map((v) => `${v.inverse ? '!' : ''}${v.label}`).join(', ');
}

export function hasActiveGamesFilterGroups(groups: GamesFilterGroupState[]): boolean {
	return groups.some((g) => g.values.some((v) => v.checked));
}
