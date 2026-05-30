import { privateEnv } from '$lib/server/private-env';
import {
	hasGoogleTranslationConfigured,
	translateTextToFrenchGoogle
} from '$lib/server/translate-google';
import { translateTextToFrenchMyMemory } from '$lib/server/translate-mymemory';

export type GameDescriptionFields = {
	description: string | null;
	descriptionFr: string | null;
};

type TranslationProvider = 'mymemory' | 'google' | 'off';

function normalizeDescription(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function resolveTranslationProvider(): TranslationProvider {
	const raw = privateEnv('TRANSLATION_PROVIDER')?.toLowerCase();
	if (raw === 'off' || raw === 'none' || raw === 'false') return 'off';
	if (raw === 'google') return 'google';
	if (raw === 'mymemory') return 'mymemory';
	return 'mymemory';
}

/** Traduit un texte vers le français (MyMemory par défaut, Google en secours ou si configuré). */
export async function translateTextToFrench(text: string): Promise<string | null> {
	const trimmed = text.trim();
	if (!trimmed) return null;

	const provider = resolveTranslationProvider();
	if (provider === 'off') return null;

	if (provider === 'google') {
		const result = await translateTextToFrenchGoogle(trimmed);
		if (result) return result;
		console.warn('[game-description-fr] Google Translate indisponible');
		return null;
	}

	const myMemory = await translateTextToFrenchMyMemory(trimmed);
	if (myMemory) return myMemory;

	if (await hasGoogleTranslationConfigured()) {
		const google = await translateTextToFrenchGoogle(trimmed);
		if (google) return google;
	}

	console.warn(
		'[game-description-fr] traduction impossible (MyMemory quota ou erreur ; Google non configuré)'
	);
	return null;
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
