import { env } from '$env/dynamic/private';
import type { DiscordOAuthIntent } from '$lib/server/discord-oauth-state';

const DISCORD_API_BASE = 'https://discord.com/api';
const DISCORD_OAUTH_SCOPES_LINK = ['identify', 'guilds.members.read'] as const;
const DISCORD_OAUTH_SCOPES_LOGIN = ['identify', 'email', 'guilds.members.read'] as const;

type DiscordTokenResponse = {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token?: string;
	scope?: string;
};

export type DiscordIdentity = {
	id: string;
	username: string;
	discriminator?: string;
	global_name?: string | null;
	avatar?: string | null;
	email?: string | null;
	verified?: boolean;
};

export function isDiscordOAuthConfigured() {
	const { clientId, clientSecret } = getDiscordOAuthConfig();
	return Boolean(clientId && clientSecret);
}

export function getDiscordOAuthScopes(intent: DiscordOAuthIntent) {
	return intent === 'login' ? [...DISCORD_OAUTH_SCOPES_LOGIN] : [...DISCORD_OAUTH_SCOPES_LINK];
}

export function getDiscordOAuthConfig() {
	const clientId = env.DISCORD_OAUTH_CLIENT_ID?.trim() ?? '';
	const clientSecret = env.DISCORD_OAUTH_CLIENT_SECRET?.trim() ?? '';
	const guildId = env.DISCORD_OAUTH_GUILD_ID?.trim() ?? '';
	const translatorRoleId = env.DISCORD_OAUTH_TRANSLATOR_ROLE_ID?.trim() ?? '';
	const autoRoleSync = isDiscordOAuthAutoRoleSyncEnabled();
	return { clientId, clientSecret, guildId, translatorRoleId, autoRoleSync };
}

/**
 * Promotion / rétrogradation automatique user ↔ translator selon le rôle Discord du serveur.
 * Activé par défaut (`DISCORD_OAUTH_AUTO_ROLE_SYNC` absent ou `true`).
 */
export function isDiscordOAuthAutoRoleSyncEnabled(): boolean {
	const raw = env.DISCORD_OAUTH_AUTO_ROLE_SYNC?.trim().toLowerCase();
	return raw !== 'false' && raw !== '0';
}

export function getDiscordAuthorizeUrl(params: {
	clientId: string;
	redirectUri: string;
	state: string;
	intent?: DiscordOAuthIntent;
}) {
	const scopes = getDiscordOAuthScopes(params.intent ?? 'link');
	const search = new URLSearchParams({
		client_id: params.clientId,
		response_type: 'code',
		redirect_uri: params.redirectUri,
		scope: scopes.join(' '),
		state: params.state,
		prompt: 'consent'
	});
	return `https://discord.com/oauth2/authorize?${search.toString()}`;
}

export async function exchangeDiscordCode(params: {
	code: string;
	clientId: string;
	clientSecret: string;
	redirectUri: string;
}) {
	const body = new URLSearchParams({
		client_id: params.clientId,
		client_secret: params.clientSecret,
		grant_type: 'authorization_code',
		code: params.code,
		redirect_uri: params.redirectUri
	});

	const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`OAuth Discord token exchange échoué (${response.status}): ${text}`);
	}

	return (await response.json()) as DiscordTokenResponse;
}

export async function getDiscordIdentity(accessToken: string) {
	const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
		headers: { authorization: `Bearer ${accessToken}` }
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Récupération profil Discord échouée (${response.status}): ${text}`);
	}
	return (await response.json()) as DiscordIdentity;
}

export async function getDiscordGuildMemberRoles(params: { accessToken: string; guildId: string }) {
	const response = await fetch(`${DISCORD_API_BASE}/users/@me/guilds/${params.guildId}/member`, {
		headers: { authorization: `Bearer ${params.accessToken}` }
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Récupération rôles Discord échouée (${response.status}): ${text}`);
	}
	const data = (await response.json()) as { roles?: string[] };
	return Array.isArray(data.roles) ? data.roles : [];
}

export async function getDiscordAvatarUrl(discordId: string) {
	const response = await fetch(
		`https://avatar-cyan.vercel.app/api/${encodeURIComponent(discordId)}`
	);
	if (!response.ok) return null;

	const data = (await response.json()) as { avatarUrl?: string };
	const avatarUrl = typeof data.avatarUrl === 'string' ? data.avatarUrl.trim() : '';
	return avatarUrl || null;
}
