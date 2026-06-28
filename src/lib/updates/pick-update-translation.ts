import type { GameTranslationRow } from '$lib/server/api/games-with-translations';

type UpdateTiming = {
	status: string;
	createdAt: Date;
	updatedAt: Date;
	/** FK directe vers la traduction à l'origine de la MAJ (null = legacy). */
	translationId?: string | null;
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

	// Lien direct fiable : on l'utilise si la trad existe encore pour ce jeu.
	if (update.translationId) {
		const exact = translations.find((t) => t.id === update.translationId);
		if (exact) return exact;
	}

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
