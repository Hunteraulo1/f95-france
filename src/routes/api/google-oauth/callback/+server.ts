import { getEffectiveConfig } from '$lib/server/app-config';
import { exchangeCodeForToken, saveOAuthTokens } from '$lib/server/google-oauth';
import { GOOGLE_OAUTH_STATE_COOKIE } from '$lib/server/google-oauth-state';
import { assertPermission } from '$lib/server/permissions';
import { isRedirect, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals, cookies }) => {
	if (!locals.user) {
		throw redirect(302, '/dashboard/account/login');
	}
	assertPermission(locals, 'config.edit', 'Accès non autorisé (configuration requise)');

	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');
	const state = url.searchParams.get('state');
	const cookieState = cookies.get(GOOGLE_OAUTH_STATE_COOKIE);
	cookies.delete(GOOGLE_OAUTH_STATE_COOKIE, { path: '/' });

	if (error) {
		throw redirect(302, `/dashboard/config?oauth_error=${encodeURIComponent(error)}`);
	}

	if (!code || !state || !cookieState || state !== cookieState) {
		throw redirect(302, '/dashboard/config?oauth_error=invalid_state');
	}

	try {
		const config = await getEffectiveConfig();
		if (!config?.googleOAuthClientId || !config?.googleOAuthClientSecret) {
			throw new Error('OAuth2 non configuré');
		}

		const redirectUri = `${url.origin}/api/google-oauth/callback`;

		const tokenResponse = await exchangeCodeForToken(
			code,
			config.googleOAuthClientId,
			config.googleOAuthClientSecret,
			redirectUri
		);

		await saveOAuthTokens(
			tokenResponse.access_token,
			tokenResponse.refresh_token,
			tokenResponse.expires_in
		);

		throw redirect(302, '/dashboard/config?oauth_success=true');
	} catch (err: unknown) {
		if (isRedirect(err)) throw err;
		console.error("Erreur lors de l'autorisation OAuth2:", err);
		const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
		throw redirect(302, `/dashboard/config?oauth_error=${encodeURIComponent(errorMessage)}`);
	}
};
