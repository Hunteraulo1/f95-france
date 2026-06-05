/** Libellé affiché quand l’email est masqué (permission `users.view_email` absente). */
export const REDACTED_USER_EMAIL_LABEL = 'Masqué';

export function formatUserEmailForDisplay(
	email: string | null | undefined,
	canView: boolean
): string {
	if (!canView) return REDACTED_USER_EMAIL_LABEL;
	return email?.trim() || '—';
}

export function formatUserAccountOptionLabel(
	username: string,
	email: string,
	canView: boolean
): string {
	if (!canView) return username;
	return `${username} (${email})`;
}

export function formatUserOwnerLabel(
	username: string,
	email: string,
	canView: boolean
): { username: string; email: string } {
	return {
		username,
		email: formatUserEmailForDisplay(email, canView)
	};
}
