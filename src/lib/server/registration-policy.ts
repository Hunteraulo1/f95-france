import { privateEnv } from '$lib/server/private-env';

export const REGISTRATION_ACCOUNT_EXISTS_MESSAGE =
	'Impossible de créer ce compte avec ces informations. Vérifiez vos données ou connectez-vous si vous avez déjà un compte.';

export const REGISTRATION_INVITE_INVALID_MESSAGE = 'Code d’invitation invalide.';

export function isRegistrationEnabled(): boolean {
	const disabled = privateEnv('REGISTRATION_DISABLED')?.trim().toLowerCase();
	return disabled !== 'true' && disabled !== '1';
}

/** Si défini, l’inscription exige ce code (variable `SERVICE_PASSWORD_REGISTRATION-INVITE-CODE`). */
export function getRequiredRegistrationInviteCode(): string | null {
	const code = privateEnv('SERVICE_PASSWORD_REGISTRATION-INVITE-CODE')?.trim();
	return code || null;
}

export function isRegistrationInviteRequired(): boolean {
	return getRequiredRegistrationInviteCode() !== null;
}

export function verifyRegistrationInvite(submitted: string | null | undefined): boolean {
	const required = getRequiredRegistrationInviteCode();
	if (!required) {
		return true;
	}
	return (submitted ?? '').trim() === required;
}
