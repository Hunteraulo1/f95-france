import type { FormGameType } from '$lib/types';

export function isNoTranslation(tname: string | null | undefined): boolean {
	return (tname ?? '') === 'no_translation';
}

export function isIntegrated(tname: string | null | undefined): boolean {
	return (tname ?? '') === 'integrated';
}

function trimStr(v: unknown): string {
	if (v == null) return '';
	return String(v).trim();
}

/** Erreurs bloquantes + avertissement description (ne bloque pas) */
export function computeGameFormFieldState(game: FormGameType): {
	fieldErrors: Record<string, boolean>;
	fieldWarns: Record<string, boolean>;
	hasBlockingError: boolean;
} {
	const noTr = isNoTranslation(game.tname);
	const integ = isIntegrated(game.tname);

	const fieldErrors: Record<string, boolean> = {};

	if (!trimStr(game.name)) fieldErrors.name = true;
	if (!trimStr(game.link)) fieldErrors.link = true;
	if (!trimStr(game.tags)) fieldErrors.tags = true;
	if (!trimStr(game.image)) fieldErrors.image = true;
	if (!trimStr(game.version)) fieldErrors.version = true;

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

	const hasBlockingError = Object.keys(fieldErrors).length > 0;

	return { fieldErrors, fieldWarns, hasBlockingError };
}
