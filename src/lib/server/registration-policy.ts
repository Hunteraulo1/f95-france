import { privateEnv } from '$lib/server/private-env';

export const REGISTRATION_ACCOUNT_EXISTS_MESSAGE =
	'Impossible de créer ce compte avec ces informations. Vérifiez vos données ou connectez-vous si vous avez déjà un compte.';

export const REGISTRATION_INVITE_INVALID_MESSAGE = 'Code d’invitation invalide.';

/** `true` si l’inscription publique est ouverte (`REGISTRATION_DISABLED` ≠ true/1). */
export function isRegistrationOpen(): boolean {
	const disabled = privateEnv('REGISTRATION_DISABLED')?.trim().toLowerCase();
	return disabled !== 'true' && disabled !== '1';
}

/** Code d’invitation configuré (`SERVICE_PASSWORD_REGISTRATION-INVITE-CODE`), sinon `null`. */
function getConfiguredRegistrationInviteCode(): string | null {
	const code = privateEnv('SERVICE_PASSWORD_REGISTRATION-INVITE-CODE')?.trim();
	return code || null;
}

/**
 * Le code d’invitation n’est exigé que lorsque l’inscription publique est fermée
 * mais qu’un code est configuré : il sert alors à contourner la fermeture.
 * Quand l’inscription est ouverte, aucun code n’est demandé même si la variable est définie.
 */
export function isRegistrationInviteRequired(): boolean {
	return !isRegistrationOpen() && getConfiguredRegistrationInviteCode() !== null;
}

/** Code d’invitation effectivement requis (`null` si aucun code n’est exigé). */
export function getRequiredRegistrationInviteCode(): string | null {
	return isRegistrationInviteRequired() ? getConfiguredRegistrationInviteCode() : null;
}

/**
 * `true` si une inscription est possible : soit l’inscription publique est ouverte,
 * soit elle est fermée mais un code d’invitation permet de s’inscrire.
 */
export function isRegistrationEnabled(): boolean {
	return isRegistrationOpen() || isRegistrationInviteRequired();
}

export function verifyRegistrationInvite(submitted: string | null | undefined): boolean {
	const required = getRequiredRegistrationInviteCode();
	if (!required) {
		return true;
	}
	return (submitted ?? '').trim() === required;
}
