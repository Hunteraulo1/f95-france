import { secureSessionCookieOptions } from '$lib/server/cookie-options';
import { safeDashboardRedirectPath } from '$lib/server/dashboard-auth';
import type { RequestEvent } from '@sveltejs/kit';

export const DISCORD_OAUTH_STATE_COOKIE = 'discord_oauth_state';
export const DISCORD_OAUTH_CTX_COOKIE = 'discord_oauth_ctx';

export type DiscordOAuthIntent = 'link' | 'login';

export type DiscordOAuthContext = {
	intent: DiscordOAuthIntent;
	redirectTo: string;
	allowRegister: boolean;
	inviteCode?: string;
};

const CTX_MAX_AGE = 60 * 10;

export function parseDiscordOAuthIntent(raw: string | null | undefined): DiscordOAuthIntent {
	return raw === 'login' ? 'login' : 'link';
}

export function setDiscordOAuthCookies(
	event: Pick<RequestEvent, 'cookies' | 'url' | 'request'>,
	params: {
		state: string;
		context: DiscordOAuthContext;
	}
) {
	const cookieOpts = secureSessionCookieOptions(event, { maxAge: CTX_MAX_AGE });
	event.cookies.set(DISCORD_OAUTH_STATE_COOKIE, params.state, cookieOpts);
	event.cookies.set(DISCORD_OAUTH_CTX_COOKIE, JSON.stringify(params.context), cookieOpts);
}

export function readDiscordOAuthCookies(cookies: RequestEvent['cookies']): {
	state: string | undefined;
	context: DiscordOAuthContext | null;
} {
	const state = cookies.get(DISCORD_OAUTH_STATE_COOKIE);
	const rawCtx = cookies.get(DISCORD_OAUTH_CTX_COOKIE);
	cookies.delete(DISCORD_OAUTH_STATE_COOKIE, { path: '/' });
	cookies.delete(DISCORD_OAUTH_CTX_COOKIE, { path: '/' });

	if (!rawCtx) {
		return { state, context: null };
	}

	try {
		const parsed = JSON.parse(rawCtx) as Partial<DiscordOAuthContext>;
		const intent = parsed.intent === 'login' ? 'login' : 'link';
		return {
			state,
			context: {
				intent,
				redirectTo: safeDashboardRedirectPath(parsed.redirectTo),
				allowRegister: parsed.allowRegister === true,
				inviteCode: typeof parsed.inviteCode === 'string' ? parsed.inviteCode : undefined
			}
		};
	} catch {
		return { state, context: null };
	}
}

export function buildDiscordOAuthContextFromUrl(url: URL): DiscordOAuthContext {
	const intent = parseDiscordOAuthIntent(url.searchParams.get('intent'));
	const allowRegister = url.searchParams.get('register') === '1';
	const inviteCode = url.searchParams.get('inviteCode')?.trim() || undefined;

	return {
		intent,
		redirectTo: safeDashboardRedirectPath(url.searchParams.get('redirectTo')),
		allowRegister,
		inviteCode
	};
}
