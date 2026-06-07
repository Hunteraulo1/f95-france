import { openOAuthToken, sealOAuthToken } from '$lib/server/config-token-crypto';
import { secureSessionCookieOptions } from '$lib/server/cookie-options';
import type { RequestEvent } from '@sveltejs/kit';

export const DISCORD_SIGNUP_PENDING_COOKIE = 'discord_signup_pending';
const PENDING_TTL_SEC = 60 * 10;

export type DiscordSignupPending = {
	discordId: string;
	email: string;
	emailVerified: boolean;
	accessToken: string;
	redirectTo: string;
	inviteCode?: string;
	discordLabel: string;
	suggestedUsername: string;
};

export function setDiscordSignupPendingCookie(
	event: Pick<RequestEvent, 'cookies' | 'url' | 'request'>,
	pending: DiscordSignupPending
) {
	const sealed = sealOAuthToken(JSON.stringify(pending));
	if (!sealed) {
		throw new Error('discord_signup_seal_failed');
	}

	event.cookies.set(
		DISCORD_SIGNUP_PENDING_COOKIE,
		sealed,
		secureSessionCookieOptions(event, { maxAge: PENDING_TTL_SEC })
	);
}

export function readDiscordSignupPendingCookie(
	cookies: RequestEvent['cookies']
): DiscordSignupPending | null {
	const stored = cookies.get(DISCORD_SIGNUP_PENDING_COOKIE);
	if (!stored) return null;

	const opened = openOAuthToken(stored);
	if (!opened) return null;

	try {
		const parsed = JSON.parse(opened) as Partial<DiscordSignupPending>;
		if (
			typeof parsed.discordId !== 'string' ||
			typeof parsed.email !== 'string' ||
			typeof parsed.accessToken !== 'string' ||
			typeof parsed.redirectTo !== 'string' ||
			typeof parsed.discordLabel !== 'string' ||
			typeof parsed.suggestedUsername !== 'string'
		) {
			return null;
		}

		return {
			discordId: parsed.discordId,
			email: parsed.email,
			emailVerified: parsed.emailVerified === true,
			accessToken: parsed.accessToken,
			redirectTo: parsed.redirectTo,
			inviteCode: typeof parsed.inviteCode === 'string' ? parsed.inviteCode : undefined,
			discordLabel: parsed.discordLabel,
			suggestedUsername: parsed.suggestedUsername
		};
	} catch {
		return null;
	}
}

export function clearDiscordSignupPendingCookie(event: Pick<RequestEvent, 'cookies' | 'url' | 'request'>) {
	event.cookies.delete(
		DISCORD_SIGNUP_PENDING_COOKIE,
		secureSessionCookieOptions(event)
	);
}
