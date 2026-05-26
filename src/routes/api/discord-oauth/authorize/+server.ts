import { secureSessionCookieOptions } from '$lib/server/cookie-options';
import { getDiscordAuthorizeUrl, getDiscordOAuthConfig } from '$lib/server/discord-oauth';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const DISCORD_OAUTH_STATE_COOKIE = 'discord_oauth_state';

export const GET: RequestHandler = async ({ locals, url, cookies, request }) => {
	if (!locals.user) {
		throw redirect(302, '/dashboard/login');
	}

	const { clientId, clientSecret } = getDiscordOAuthConfig();
	if (!clientId || !clientSecret) {
		throw redirect(302, '/dashboard/settings?discord_error=oauth_not_configured');
	}

	const state = crypto.randomUUID();
	cookies.set(
		DISCORD_OAUTH_STATE_COOKIE,
		state,
		secureSessionCookieOptions({ url, request }, { maxAge: 60 * 10 })
	);

	const redirectUri = `${url.origin}/api/discord-oauth/callback`;
	const authorizeUrl = getDiscordAuthorizeUrl({ clientId, redirectUri, state });
	throw redirect(302, authorizeUrl);
};
