import type { FormGameType } from '$lib/types';
import { gameAutoCheckEnabledForWebsite } from '$lib/utils/game-auto-check';
import { isGameImageGalleryPageUrl } from '$lib/utils/game-image-url';
import { safeParseRequiredHttpUrl } from '$lib/utils/link-validation';

export function isNoTranslation(tname: string | null | undefined): boolean {
	return (tname ?? '') === 'no_translation';
}

export function isIntegrated(tname: string | null | undefined): boolean {
	return (tname ?? '') === 'integrated';
}

export function requiresTranslationVersion(tname: string | null | undefined): boolean {
	return !isNoTranslation(tname);
}

/** Valeur `tversion` à persister selon le statut de traduction. */
export function normalizeTranslationTversion(
	tname: string | null | undefined,
	tversion: string | null | undefined
): string {
	if (isNoTranslation(tname)) return '';
	if (isIntegrated(tname)) return 'Intégrée';
	return trimStr(tversion);
}

/** Message d’erreur si `tversion` est incohérent avec `tname`, sinon `null`. */
export function validateTranslationTversion(
	tname: string | null | undefined,
	tversion: string | null | undefined
): string | null {
	const tv = trimStr(tversion);
	if (isNoTranslation(tname)) {
		if (tv) return 'La version de traduction doit rester vide pour « Pas de traduction »';
		return null;
	}
	if (isIntegrated(tname)) {
		if (tv && tv !== 'Intégrée') {
			return 'La version de traduction doit être « Intégrée » pour une traduction intégrée';
		}
		return null;
	}
	if (!tv) return 'La version de traduction est obligatoire';
	return null;
}

function trimStr(v: unknown): string {
	if (v == null) return '';
	return String(v).trim();
}

/**
 * F95Zone : vignette obligatoire.
 * LewdCorner : obligatoire seulement si le scrape a fourni une image (formulaire add).
 * LC sans auto-check (toujours le cas en base) : jamais obligatoire.
 * Autre : jamais obligatoire.
 */
export function gameImageRequiredForWebsite(
	website: string | null | undefined,
	opts?: { lcScrapeProvidedImage?: boolean; gameAutoCheck?: boolean | null }
): boolean {
	const w = trimStr(website);
	if (w === 'f95z') return true;
	if (w === 'lc') {
		// LC : l’auto-check jeu n’existe pas — l’image n’est jamais obligatoire en édition.
		if (!gameAutoCheckEnabledForWebsite(w)) return false;
		if (opts?.gameAutoCheck === false) return false;
		return Boolean(opts?.lcScrapeProvidedImage);
	}
	return false;
}

/**
 * Image obligatoire lors de la modification d’un jeu déjà en base.
 * Un jeu LC reste sans vignette obligatoire, même si le champ « site » du formulaire est mal saisi.
 */
export function gameImageRequiredForEdit(
	existingWebsite: string | null | undefined,
	newWebsite: string | null | undefined,
	opts?: { lcScrapeProvidedImage?: boolean; gameAutoCheck?: boolean | null }
): boolean {
	if (trimStr(existingWebsite) === 'lc') return false;
	const target = trimStr(newWebsite) || trimStr(existingWebsite);
	return gameImageRequiredForWebsite(target, opts);
}

/**
 * Image persistée en base : chaîne vide si LC sans auto-check ou URL invalide / galerie quand l’image est optionnelle.
 */
export function normalizeGameImageForStorage(
	website: string | null | undefined,
	image: unknown,
	opts?: { gameAutoCheck?: boolean | null; lcScrapeProvidedImage?: boolean }
): string {
	const imageVal = trimStr(image);
	const required = gameImageRequiredForWebsite(website, opts);
	if (!imageVal) return '';
	if (required) return imageVal;
	if (!safeParseRequiredHttpUrl(imageVal).success) return '';
	if (isGameImageGalleryPageUrl(imageVal)) return '';
	return imageVal;
}

/** Erreurs bloquantes + avertissement description (ne bloque pas) */
export function computeGameFormFieldState(
	game: FormGameType,
	opts?: { requireImage?: boolean }
): {
	fieldErrors: Record<string, boolean>;
	fieldWarns: Record<string, boolean>;
	hasBlockingError: boolean;
} {
	const requireImage = opts?.requireImage ?? true;
	const noTr = isNoTranslation(game.tname);
	const integ = isIntegrated(game.tname);

	const fieldErrors: Record<string, boolean> = {};

	if (!trimStr(game.name)) fieldErrors.name = true;
	const linkVal = trimStr(game.link);
	if (!linkVal) {
		fieldErrors.link = true;
	} else if (!safeParseRequiredHttpUrl(linkVal).success) {
		fieldErrors.link = true;
	}
	if (!trimStr(game.tags)) fieldErrors.tags = true;
	const imageVal = trimStr(game.image);
	if (requireImage && !imageVal) {
		fieldErrors.image = true;
	} else if (requireImage && imageVal && !safeParseRequiredHttpUrl(imageVal).success) {
		fieldErrors.image = true;
	}
	if (!trimStr(game.gameVersion)) fieldErrors.gameVersion = true;

	if (noTr) {
		if (trimStr(game.tversion)) fieldErrors.tversion = true;
	} else if (integ) {
		if (trimStr(game.tversion) !== 'Intégrée') fieldErrors.tversion = true;
	} else {
		if (!trimStr(game.tversion)) fieldErrors.tversion = true;
	}

	const tlinkVal = trimStr(game.tlink);
	if (noTr || integ) {
		if (tlinkVal && !safeParseRequiredHttpUrl(tlinkVal).success) fieldErrors.tlink = true;
	} else {
		if (!tlinkVal) {
			fieldErrors.tlink = true;
		} else if (!safeParseRequiredHttpUrl(tlinkVal).success) {
			fieldErrors.tlink = true;
		}
	}

	const fieldWarns: Record<string, boolean> = {};
	if (!trimStr(game.description)) fieldWarns.description = true;
	if (trimStr(game.image) && isGameImageGalleryPageUrl(game.image)) fieldWarns.image = true;

	const hasBlockingError = Object.keys(fieldErrors).length > 0;

	return { fieldErrors, fieldWarns, hasBlockingError };
}
