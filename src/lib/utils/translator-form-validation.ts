import type { Translator } from '$lib/server/db/schema';
import type { FormGameType } from '$lib/types';

/** Traducteur/relecteur inconnu (admin / superadmin en mode direct) — traité comme erreur bloquante */
export function translatorFieldInvalid(
	value: string | null | undefined,
	translators: readonly Translator[],
	checkUnknown: boolean
): boolean {
	if (!checkUnknown) return false;
	const v = (value ?? '').trim();
	if (!v) return false;
	return !translators.some((item) => item.name === v);
}

export function translatorProofreaderConflict(game: FormGameType): boolean {
	const tid = (game.translatorId ?? '').trim();
	if (!tid) return false;
	return tid === (game.proofreaderId ?? '').trim();
}

export function getTranslatorFieldErrors(
	game: FormGameType,
	translators: readonly Translator[],
	checkUnknown: boolean
): { translatorId: boolean; proofreaderId: boolean } {
	const conflict = translatorProofreaderConflict(game);
	const unkT = translatorFieldInvalid(game.translatorId, translators, checkUnknown);
	const unkP = translatorFieldInvalid(game.proofreaderId, translators, checkUnknown);
	return {
		translatorId: conflict || unkT,
		proofreaderId: conflict || unkP
	};
}

export function formHasTranslatorInputIssue(
	game: FormGameType,
	translators: readonly Translator[],
	checkUnknown: boolean
): boolean {
	const e = getTranslatorFieldErrors(game, translators, checkUnknown);
	return e.translatorId || e.proofreaderId;
}
