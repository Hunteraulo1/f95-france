import { completeDiscordLogin, linkDiscordToUser, parseDiscordId } from '$lib/server/discord-auth';
import {
	exchangeDiscordCode,
	getDiscordIdentity,
	getDiscordOAuthConfig
} from '$lib/server/discord-oauth';
import { readDiscordOAuthCookies } from '$lib/server/discord-oauth-state';
import { isRedirect, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function loginErrorRedirect(code: string) {
	return redirect(302, `/dashboard/account/login?discord_error=${encodeURIComponent(code)}`);
}

function linkErrorRedirect(code: string) {
	return redirect(302, `/dashboard/settings?discord_error=${encodeURIComponent(code)}`);
}

export const GET: RequestHandler = async (event) => {
	const { locals, url, cookies } = event;
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');
	const { state: cookieState, context } = readDiscordOAuthCookies(cookies);

	const intent = context?.intent ?? 'link';
	const errorRedirect = intent === 'login' ? loginErrorRedirect : linkErrorRedirect;

	if (error) {
		throw errorRedirect(error === 'access_denied' ? 'access_denied' : error);
	}
	if (!code || !state || !cookieState || state !== cookieState || !context) {
		throw errorRedirect('invalid_state');
	}

	const { clientId, clientSecret, guildId, translatorRoleId, autoRoleSync } =
		getDiscordOAuthConfig();
	if (!clientId || !clientSecret) {
		throw errorRedirect('oauth_not_configured');
	}

	try {
		const redirectUri = `${url.origin}/api/discord-oauth/callback`;
		const token = await exchangeDiscordCode({ code, clientId, clientSecret, redirectUri });
		const identity = await getDiscordIdentity(token.access_token);
		const discordId = parseDiscordId(identity);

		if (!discordId) {
			throw errorRedirect('invalid_discord_id');
		}

		if (context.intent === 'login') {
			const destination = await completeDiscordLogin({
				event,
				context,
				identity,
				discordId,
				accessToken: token.access_token,
				autoRoleSync,
				guildId,
				translatorRoleId
			});
			throw redirect(302, destination);
		}

		if (!locals.user) {
			throw redirect(302, '/dashboard/account/login');
		}

		const isStaffAccount = locals.permissions?.includes('users.manage') ?? false;

		try {
			await linkDiscordToUser({
				userId: locals.user.id,
				discordId,
				accessToken: token.access_token,
				isStaffAccount,
				autoRoleSync,
				guildId,
				translatorRoleId
			});
		} catch (linkError) {
			if (linkError instanceof Error && linkError.message === 'discord_already_linked') {
				throw linkErrorRedirect('discord_already_linked');
			}
			throw linkError;
		}

		throw redirect(302, '/dashboard/settings?discord_success=linked');
	} catch (callbackError: unknown) {
		if (isRedirect(callbackError)) throw callbackError;

		if (callbackError instanceof Error) {
			const known = callbackError.message;
			if (
				known in
				{
					registration_disabled: 1,
					invite_invalid: 1,
					account_exists: 1,
					email_required: 1
				}
			) {
				throw errorRedirect(known);
			}
		}

		console.error('Erreur callback OAuth Discord:', callbackError);
		throw errorRedirect('callback_failed');
	}
};
