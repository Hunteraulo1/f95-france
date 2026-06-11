export function normalizeTranslatorFk(id: string | null | undefined): string | null {
	if (id == null) return null;
	const trimmed = String(id).trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function translatorFkChanged(
	before: string | null | undefined,
	after: string | null | undefined
): boolean {
	return normalizeTranslatorFk(before) !== normalizeTranslatorFk(after);
}

/** Réactive le suivi traducteur quand l’assignation change (défaut schéma = true). */
export function resolveTranslatorAlertsEnabledOnWrite(input: {
	beforeTranslatorId: string | null | undefined;
	afterTranslatorId: string | null | undefined;
	currentTranslatorAlertsEnabled: boolean;
}): boolean {
	if (translatorFkChanged(input.beforeTranslatorId, input.afterTranslatorId)) {
		return true;
	}
	return input.currentTranslatorAlertsEnabled;
}
