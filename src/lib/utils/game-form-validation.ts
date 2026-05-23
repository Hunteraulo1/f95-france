import type { FormGameType } from '$lib/types';
import { isGameImageGalleryPageUrl } from '$lib/utils/game-image-url';

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
 * Autre : jamais obligatoire.
 */
export function gameImageRequiredForWebsite(
	website: string | null | undefined,
	opts?: { lcScrapeProvidedImage?: boolean }
): boolean {
	const w = trimStr(website);
	if (w === 'f95z') return true;
	if (w === 'lc') return Boolean(opts?.lcScrapeProvidedImage);
	return false;
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
	if (!trimStr(game.link)) fieldErrors.link = true;
	if (!trimStr(game.tags)) fieldErrors.tags = true;
	if (requireImage && !trimStr(game.image)) fieldErrors.image = true;
	if (!trimStr(game.gameVersion)) fieldErrors.gameVersion = true;

	if (noTr) {
		if (trimStr(game.tversion)) fieldErrors.tversion = true;
	} else if (integ) {
		if (trimStr(game.tversion) !== 'Intégrée') fieldErrors.tversion = true;
	} else {
		if (!trimStr(game.tversion)) fieldErrors.tversion = true;
	}

	if (noTr || integ) {
		if (trimStr(game.tlink)) fieldErrors.tlink = true;
	} else {
		if (!trimStr(game.tlink)) fieldErrors.tlink = true;
	}

	const fieldWarns: Record<string, boolean> = {};
	if (!trimStr(game.description)) fieldWarns.description = true;
	if (trimStr(game.image) && isGameImageGalleryPageUrl(game.image)) fieldWarns.image = true;

	const hasBlockingError = Object.keys(fieldErrors).length > 0;

	return { fieldErrors, fieldWarns, hasBlockingError };
}
