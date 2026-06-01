import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	exchangeDiscordCode,
	getDiscordAvatarUrl,
	getDiscordGuildMemberRoles,
	getDiscordIdentity,
	getDiscordOAuthConfig
} from '$lib/server/discord-oauth';
import { isRedirect, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const DISCORD_OAUTH_STATE_COOKIE = 'discord_oauth_state';

export const GET: RequestHandler = async ({ locals, url, cookies }) => {
	if (!locals.user) {
		throw redirect(302, '/dashboard/login');
	}

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');
	const cookieState = cookies.get(DISCORD_OAUTH_STATE_COOKIE);
	cookies.delete(DISCORD_OAUTH_STATE_COOKIE, { path: '/' });

	if (error) {
		throw redirect(302, `/dashboard/settings?discord_error=${encodeURIComponent(error)}`);
	}
	if (!code || !state || !cookieState || state !== cookieState) {
		throw redirect(302, '/dashboard/settings?discord_error=invalid_state');
	}

	const { clientId, clientSecret, guildId, translatorRoleId, autoRoleSync } =
		getDiscordOAuthConfig();
	if (!clientId || !clientSecret) {
		throw redirect(302, '/dashboard/settings?discord_error=oauth_not_configured');
	}

	try {
		const redirectUri = `${url.origin}/api/discord-oauth/callback`;
		const token = await exchangeDiscordCode({ code, clientId, clientSecret, redirectUri });
		const identity = await getDiscordIdentity(token.access_token);
		const discordId = identity.id?.trim();

		if (!/^\d{17,20}$/.test(discordId)) {
			throw redirect(302, '/dashboard/settings?discord_error=invalid_discord_id');
		}

		const [currentUser] = await db
			.select({ avatar: table.user.avatar, role: table.user.role })
			.from(table.user)
			.where(eq(table.user.id, locals.user.id))
			.limit(1);

		await db.update(table.user).set({ discordId }).where(eq(table.user.id, locals.user.id));

		const [matchingTranslator] = await db
			.select({ id: table.translator.id, userId: table.translator.userId })
			.from(table.translator)
			.where(eq(table.translator.discordId, discordId))
			.limit(1);
		if (
			matchingTranslator &&
			(!matchingTranslator.userId || matchingTranslator.userId === locals.user.id)
		) {
			await db
				.update(table.translator)
				.set({ userId: locals.user.id })
				.where(eq(table.translator.id, matchingTranslator.id));
		}

		if ((currentUser?.avatar ?? '').trim() === '') {
			const avatarUrl = await getDiscordAvatarUrl(discordId);
			if (avatarUrl) {
				await db
					.update(table.user)
					.set({ avatar: avatarUrl })
					.where(eq(table.user.id, locals.user.id));
			}
		}

		if (autoRoleSync && guildId && translatorRoleId) {
			const roleIds = await getDiscordGuildMemberRoles({
				accessToken: token.access_token,
				guildId
			});
			const hasTranslatorRole = roleIds.includes(translatorRoleId);
			const currentRole = currentUser?.role ?? 'user';
			const isStaffAccount =
				locals.user != null && (locals.permissions?.includes('users.manage') ?? false);

			if (!isStaffAccount && hasTranslatorRole && currentRole === 'user') {
				await db
					.update(table.user)
					.set({ role: 'translator' })
					.where(eq(table.user.id, locals.user.id));
			}
			if (!isStaffAccount && !hasTranslatorRole && currentRole === 'translator') {
				await db.update(table.user).set({ role: 'user' }).where(eq(table.user.id, locals.user.id));
			}
		}

		throw redirect(302, '/dashboard/settings?discord_success=linked');
	} catch (error: unknown) {
		if (isRedirect(error)) throw error;
		console.error('Erreur callback OAuth Discord:', error);
		throw redirect(302, '/dashboard/settings?discord_error=callback_failed');
	}
};
