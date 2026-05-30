import type { GameTranslationRow } from '$lib/server/api/games-with-translations';

type UpdateTiming = {
	status: string;
	createdAt: Date;
	updatedAt: Date;
};

function closestByTimestamp(
	translations: GameTranslationRow[],
	getTime: (translation: GameTranslationRow) => number,
	referenceMs: number
): GameTranslationRow {
	return translations.reduce((best, current) => {
		const currentDist = Math.abs(getTime(current) - referenceMs);
		const bestDist = Math.abs(getTime(best) - referenceMs);
		return currentDist < bestDist ? current : best;
	});
}

/** Traduction la plus probablement liée à une ligne `update` (pas de FK directe). */
export function pickTranslationForUpdate(
	update: UpdateTiming,
	translations: GameTranslationRow[]
): GameTranslationRow | null {
	if (translations.length === 0) return null;
	if (translations.length === 1) return translations[0];

	const referenceMs = update.updatedAt.getTime();

	if (update.status === 'adding') {
		return closestByTimestamp(
			translations,
			(translation) => translation.createdAt.getTime(),
			referenceMs
		);
	}

	return closestByTimestamp(
		translations,
		(translation) => translation.updatedAt.getTime(),
		referenceMs
	);
}
