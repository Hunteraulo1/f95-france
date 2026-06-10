import { getDiscordAuthorizeUrl, getDiscordOAuthConfig } from '$lib/server/discord-oauth';
import {
	buildDiscordOAuthContextFromUrl,
	setDiscordOAuthCookies
} from '$lib/server/discord-oauth-state';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url, cookies, request }) => {
	const context = buildDiscordOAuthContextFromUrl(url);

	if (context.intent === 'link' && !locals.user) {
		throw redirect(302, '/dashboard/login');
	}

	if (context.intent === 'login' && locals.user) {
		throw redirect(302, context.redirectTo);
	}

	const { clientId, clientSecret } = getDiscordOAuthConfig();
	if (!clientId || !clientSecret) {
		const errorTarget =
			context.intent === 'login'
				? '/dashboard/login?discord_error=oauth_not_configured'
				: '/dashboard/settings?discord_error=oauth_not_configured';
		throw redirect(302, errorTarget);
	}

	const state = crypto.randomUUID();
	setDiscordOAuthCookies({ cookies, url, request }, { state, context });

	const redirectUri = `${url.origin}/api/discord-oauth/callback`;
	const authorizeUrl = getDiscordAuthorizeUrl({
		clientId,
		redirectUri,
		state,
		intent: context.intent
	});
	throw redirect(302, authorizeUrl);
};
