import type { PublicUpdateRow } from '$lib/server/public-updates';

export type UpdatesDaySection = {
	status: string;
	label: string;
	items: PublicUpdateRow[];
};

export type UpdatesDayGroup = {
	dayKey: string;
	dayLabel: string;
	sections: UpdatesDaySection[];
};

const TYPE_ORDER = ['adding', 'update'] as const;

const TYPE_LABELS: Record<string, string> = {
	adding: 'Ajout de jeu',
	update: 'Mise à jour'
};

function localDayKey(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function formatDayLabel(dayKey: string): string {
	const [y, m, d] = dayKey.split('-').map(Number);
	const label = new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
	return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Regroupe les entrées déjà triées par jour puis par type (ajout → mise à jour). */
export function groupUpdatesByDayAndType(updates: PublicUpdateRow[]): UpdatesDayGroup[] {
	const days = new Map<string, Map<string, PublicUpdateRow[]>>();

	for (const update of updates) {
		const dayKey = localDayKey(new Date(update.createdAt));
		if (!days.has(dayKey)) days.set(dayKey, new Map());
		const sections = days.get(dayKey)!;
		if (!sections.has(update.status)) sections.set(update.status, []);
		sections.get(update.status)!.push(update);
	}

	const sortedDayKeys = [...days.keys()].sort((a, b) => b.localeCompare(a));

	return sortedDayKeys.map((dayKey) => {
		const sectionsMap = days.get(dayKey)!;
		const sections: UpdatesDaySection[] = [];

		for (const status of TYPE_ORDER) {
			const items = sectionsMap.get(status);
			if (!items?.length) continue;
			sections.push({
				status,
				label: TYPE_LABELS[status] ?? status,
				items
			});
		}

		for (const [status, items] of sectionsMap) {
			if (TYPE_ORDER.includes(status as (typeof TYPE_ORDER)[number])) continue;
			if (!items.length) continue;
			sections.push({
				status,
				label: TYPE_LABELS[status] ?? status,
				items
			});
		}

		return {
			dayKey,
			dayLabel: formatDayLabel(dayKey),
			sections
		};
	});
}
