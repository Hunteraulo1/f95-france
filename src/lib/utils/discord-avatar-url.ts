export const DISCORD_AVATAR_API_BASE_URL = 'https://avatar-cyan.vercel.app/api';
export const DISCORD_AVATAR_DEFAULT_SIZE = 256;

const DISCORD_CDN_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);

export function discordAvatarApiUrl(
	discordId: string,
	size: number = DISCORD_AVATAR_DEFAULT_SIZE
): string {
	const id = discordId.trim();
	return `${DISCORD_AVATAR_API_BASE_URL}/${encodeURIComponent(id)}?size=${size}`;
}

export function isDiscordCdnAvatarUrl(raw: string | null | undefined): boolean {
	const url = (raw ?? '').trim();
	if (!url) return false;
	try {
		return DISCORD_CDN_HOSTS.has(new URL(url).hostname.toLowerCase());
	} catch {
		return false;
	}
}

/** Ajoute ou remplace `size` sur les URLs CDN Discord servies en `<img src>`. */
export function resolveDiscordAvatarDisplayUrl(
	raw: string | null | undefined,
	size: number = DISCORD_AVATAR_DEFAULT_SIZE
): string {
	const url = (raw ?? '').trim();
	if (!url || !isDiscordCdnAvatarUrl(url)) return url;
	const parsed = new URL(url);
	parsed.searchParams.set('size', String(size));
	return parsed.toString();
}
