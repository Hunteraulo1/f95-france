function safeDashboardRedirectPath(candidate: string | null | undefined): string {
	const raw = (candidate ?? '').trim();
	if (!raw.startsWith('/dashboard') || raw.startsWith('//')) {
		return '/dashboard';
	}
	return raw;
}

/** Chemin d’autorisation OAuth Discord (login ou inscription). */
export function discordOAuthAuthorizePath(options?: {
	redirectTo?: string;
	register?: boolean;
	inviteCode?: string;
}) {
	const search = new URLSearchParams({ intent: 'login' });
	const redirectTo = safeDashboardRedirectPath(options?.redirectTo);
	if (redirectTo !== '/dashboard') {
		search.set('redirectTo', redirectTo);
	}
	if (options?.register) {
		search.set('register', '1');
	}
	if (options?.inviteCode?.trim()) {
		search.set('inviteCode', options.inviteCode.trim());
	}
	return `/api/discord-oauth/authorize?${search.toString()}`;
}

export const DISCORD_LOGIN_ERROR_MESSAGES: Record<string, string> = {
	oauth_not_configured: 'La connexion Discord n’est pas configurée sur ce site.',
	invalid_state: 'Session OAuth expirée ou invalide. Réessayez.',
	access_denied: 'Autorisation Discord annulée.',
	invalid_discord_id: 'Identifiant Discord invalide.',
	callback_failed: 'Impossible de finaliser la connexion Discord.',
	no_account:
		'Aucun compte n’est associé à ce Discord. Reconnectez-vous avec Discord pour créer un compte.',
	signup_expired:
		'La session Discord a expiré. Cliquez à nouveau sur « Se connecter avec Discord ».',
	registration_disabled:
		'Les inscriptions sont fermées. Impossible de créer un compte via Discord.',
	invite_required: 'Un code d’invitation est requis pour s’inscrire via Discord.',
	invite_invalid: 'Code d’invitation invalide.',
	discord_already_linked: 'Ce compte Discord est déjà lié à un autre utilisateur.',
	account_exists:
		'Impossible de créer ce compte avec ces informations. Vérifiez vos données ou connectez-vous si vous avez déjà un compte.',
	email_required:
		'Discord n’a pas fourni d’adresse email. Autorisez l’accès à votre email ou créez un compte classique.'
};

export function discordLoginErrorMessage(code: string | null | undefined): string | null {
	if (!code) return null;
	return DISCORD_LOGIN_ERROR_MESSAGES[code] ?? code;
}
