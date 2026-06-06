import {
    isDescriptionAutoTranslateEnabled,
    translateTextToFrenchLibreTranslate
} from '$lib/server/translate-libretranslate';

export type GameDescriptionFields = {
	description: string | null;
	descriptionFr: string | null;
};

function normalizeDescription(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

/** Traduit un texte vers le français via LibreTranslate. */
export async function translateTextToFrench(text: string): Promise<string | null> {
	const trimmed = text.trim();
	if (!trimmed || !isDescriptionAutoTranslateEnabled()) return null;

	const result = await translateTextToFrenchLibreTranslate(trimmed);
	if (!result) {
		console.warn('[game-description-fr] traduction LibreTranslate impossible');
	}
	return result;
}

/**
 * Prépare `description` + `description_fr` pour persistance.
 * Si `explicitDescriptionFr` est fourni (y compris `null`), aucune traduction auto.
 */
export async function resolveGameDescriptionFields(options: {
	description?: string | null;
	explicitDescriptionFr?: string | null;
	previousDescription?: string | null;
	previousDescriptionFr?: string | null;
	autoTranslate?: boolean;
}): Promise<GameDescriptionFields> {
	const description = normalizeDescription(options.description);
	const autoTranslate = options.autoTranslate !== false;

	if (options.explicitDescriptionFr !== undefined) {
		return {
			description,
			descriptionFr: normalizeDescription(options.explicitDescriptionFr)
		};
	}

	if (!description) {
		return { description: null, descriptionFr: null };
	}

	const previousDescription = normalizeDescription(options.previousDescription);
	const previousDescriptionFr = normalizeDescription(options.previousDescriptionFr);

	if (!autoTranslate) {
		return { description, descriptionFr: previousDescriptionFr };
	}

	if (description === previousDescription && previousDescriptionFr) {
		return { description, descriptionFr: previousDescriptionFr };
	}

	const descriptionFr = await translateTextToFrench(description);
	return { description, descriptionFr };
}
