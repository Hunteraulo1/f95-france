import { getEffectiveConfig } from '$lib/server/app-config';
import { getGoogleAuthUrl } from '$lib/server/google-oauth';
import { GOOGLE_OAUTH_STATE_COOKIE } from '$lib/server/google-oauth-state';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals, cookies }) => {
	if (!locals.user) {
		throw redirect(302, '/dashboard/login');
	}
	if (locals.user.role !== 'superadmin') {
		throw new Error('Accès non autorisé (superadmin requis)');
	}

	const config = await getEffectiveConfig();
	if (!config?.googleOAuthClientId) {
		throw new Error('Client ID OAuth2 non configuré');
	}

	const redirectUri = `${url.origin}/api/google-oauth/callback`;
	const state = crypto.randomUUID();

	cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
		path: '/',
		httpOnly: true,
		secure: url.protocol === 'https:',
		sameSite: 'lax',
		maxAge: 600
	});

	const authUrl = getGoogleAuthUrl(config.googleOAuthClientId, redirectUri, state);

	throw redirect(302, authUrl);
};
