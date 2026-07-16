import { appLogWarn } from '$lib/server/app-log-bridge';
import {
	AUTO_CHECK_EMBEDS_PER_MESSAGE,
	buildAutoCheckVersionBumpEmbed,
	type DiscordEmbed,
	type TranslatorVersionBumpLine
} from '$lib/server/discord-webhook';
import { privateEnv } from '$lib/server/private-env';

/**
 * Envoi de MP Discord via un bot (`DISCORD_BOT_TOKEN`), en complément des webhooks
 * de salon. Le bot doit partager un serveur avec le destinataire pour pouvoir ouvrir
 * un canal MP.
 *
 * @see https://discord.com/developers/docs/resources/user#create-dm
 * @see https://discord.com/developers/docs/resources/channel#create-message
 */

const DISCORD_API = 'https://discord.com/api/v10';

/** Code Discord renvoyé quand le destinataire a fermé ses MP ou bloqué le bot. */
const BLOCKED_DM_ERROR_CODE = 50007;

export function getDiscordBotToken(): string | null {
	return privateEnv('DISCORD_BOT_TOKEN')?.trim() || null;
}

export type DiscordDmSendResult =
	{ ok: true } | { ok: false; blocked: boolean; status?: number; error: string };

function isBlockedDmError(status: number | undefined, body: string | undefined): boolean {
	if (status !== 403 || !body) return false;
	try {
		const parsed = JSON.parse(body) as { code?: number };
		return parsed.code === BLOCKED_DM_ERROR_CODE;
	} catch {
		return false;
	}
}

async function openDmChannel(
	discordUserId: string,
	token: string
): Promise<{ channelId: string } | { status: number; body: string }> {
	const res = await fetch(`${DISCORD_API}/users/@me/channels`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bot ${token}` },
		body: JSON.stringify({ recipient_id: discordUserId }),
		signal: AbortSignal.timeout(15_000)
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		return { status: res.status, body };
	}
	const json = (await res.json()) as { id: string };
	return { channelId: json.id };
}

async function postDmMessage(
	channelId: string,
	token: string,
	payload: { content?: string; embeds?: DiscordEmbed[] }
): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
	const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bot ${token}` },
		body: JSON.stringify({ content: payload.content ?? '', embeds: payload.embeds ?? [] }),
		signal: AbortSignal.timeout(15_000)
	});
	if (res.ok) return { ok: true };
	const body = await res.text().catch(() => '');
	return { ok: false, status: res.status, body };
}

/**
 * Envoie un MP Discord via le bot. Ne lève pas : `blocked: true` signale que le
 * destinataire a désactivé ses MP ou bloqué le bot (code Discord 50007), ce qui doit
 * déclencher un repli sur le canal côté appelant.
 */
export async function sendDiscordBotDirectMessage(
	discordUserId: string,
	payload: { content?: string; embeds?: DiscordEmbed[] }
): Promise<DiscordDmSendResult> {
	const token = getDiscordBotToken();
	if (!token) return { ok: false, blocked: false, error: 'DISCORD_BOT_TOKEN non configuré' };

	try {
		const channel = await openDmChannel(discordUserId, token);
		if ('status' in channel) {
			const blocked = isBlockedDmError(channel.status, channel.body);
			appLogWarn('notification', 'Discord bot : ouverture du canal MP échouée', undefined, {
				discordUserId,
				status: channel.status,
				body: channel.body.slice(0, 300)
			});
			return { ok: false, blocked, status: channel.status, error: channel.body.slice(0, 300) };
		}

		const sent = await postDmMessage(channel.channelId, token, payload);
		if (!sent.ok) {
			const blocked = isBlockedDmError(sent.status, sent.body);
			appLogWarn('notification', 'Discord bot : envoi du MP échoué', undefined, {
				discordUserId,
				status: sent.status,
				body: sent.body.slice(0, 300)
			});
			return { ok: false, blocked, status: sent.status, error: sent.body.slice(0, 300) };
		}
		return { ok: true };
	} catch (e) {
		appLogWarn('notification', 'Discord bot : MP échoué', e, { discordUserId });
		return { ok: false, blocked: false, error: e instanceof Error ? e.message : String(e) };
	}
}

/**
 * MP « montée de version » pour un traducteur donné : mêmes embeds que le webhook de
 * salon, batchés par lots de {@link AUTO_CHECK_EMBEDS_PER_MESSAGE}. S'arrête au premier
 * échec pour laisser l'appelant replier l'intégralité des lignes sur le canal.
 */
export async function sendDiscordBotTranslatorVersionBumpDm(
	discordUserId: string,
	lines: TranslatorVersionBumpLine[]
): Promise<DiscordDmSendResult> {
	const capped = lines.slice(0, 20);
	for (let i = 0; i < capped.length; i += AUTO_CHECK_EMBEDS_PER_MESSAGE) {
		const batch = capped.slice(i, i + AUTO_CHECK_EMBEDS_PER_MESSAGE);
		const embeds = batch.map((line) => buildAutoCheckVersionBumpEmbed(line, 'F95 France'));
		const result = await sendDiscordBotDirectMessage(discordUserId, {
			content: i === 0 && capped.length > 1 ? 'Jeux mis à jour (Auto-Check)' : undefined,
			embeds
		});
		if (!result.ok) return result;
	}
	return { ok: true };
}
