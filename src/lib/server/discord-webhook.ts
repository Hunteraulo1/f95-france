import { getEffectiveConfig } from '$lib/server/app-config';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { privateEnv } from '$lib/server/private-env';
import { strTrim, tradVerIndicatesIntegrated } from '$lib/server/translation-notify-rules';
import { resolveGameImageSrc } from '$lib/utils/game-image-url';
import { eq } from 'drizzle-orm';

/**
 * Envoi vers les webhooks Discord configurés dans {@link table.config}
 * (même esprit que l’ancien projet f95list-form : embeds JSON vers l’API Discord).
 *
 * @see https://discord.com/developers/docs/resources/webhook#execute-webhook
 */

export type DiscordEmbed = {
	title?: string;
	description?: string;
	color?: number;
	url?: string;
	fields?: { name: string; value: string; inline?: boolean }[];
	author?: { name: string; url?: string; icon_url?: string };
	image?: { url: string };
	footer?: { text: string };
};

type WebhookUrls = {
	updates: string | null;
	translators: string | null;
	admin: string | null;
};

let cached: { urls: WebhookUrls; at: number; envSig: string } | null = null;
const CACHE_MS = 60_000;

function webhookEnvSignature(): string {
	return [
		privateEnv('DISCORD_WEBHOOK_UPDATES'),
		privateEnv('DISCORD_WEBHOOK_TRANSLATORS'),
		privateEnv('DISCORD_WEBHOOK_PROOFREADERS')
	].join('\0');
}

async function getWebhookUrls(forceRefresh = false): Promise<WebhookUrls> {
	const now = Date.now();
	const envSig = webhookEnvSignature();
	if (!forceRefresh && cached && now - cached.at < CACHE_MS && cached.envSig === envSig) {
		return cached.urls;
	}
	const cfg = await getEffectiveConfig();
	const urls: WebhookUrls = {
		updates: cfg?.discordWebhookUpdates ?? null,
		translators: cfg?.discordWebhookTranslators ?? null,
		admin: cfg?.discordWebhookProofreaders ?? null
	};
	cached = { urls, at: now, envSig };
	return urls;
}

function trimFieldValue(s: string, max = 1000): string {
	const t = s.trim();
	return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/**
 * Webhook canal « updates » : pour une modification de traduction déjà en base,
 * n’envoyer que si la version de traduction change, ou si la version jeu (ligne) change
 * pour une entrée intégrée / Trad. Ver. « Intégrée ».
 */
function shouldNotifyTranslationModificationForUpdatesChannel(
	next: Record<string, unknown>,
	prev: Record<string, unknown>
): boolean {
	const tversionChanged = strTrim(next.tversion) !== strTrim(prev.tversion);
	const versionChanged = strTrim(next.version) !== strTrim(prev.version);
	const integratedTradVer = tradVerIndicatesIntegrated(next.tversion, next.tname);
	return tversionChanged || (versionChanged && integratedTradVer);
}

/** Discord n’accepte que des URLs absolues pour les images d’embed. */
function embedImageUrl(raw: string | null | undefined): string | undefined {
	if (!raw || typeof raw !== 'string') return undefined;
	const u = resolveGameImageSrc(raw);
	if (!u) return undefined;
	if (u.startsWith('https://') || u.startsWith('http://')) return u;
	return undefined;
}

type TrRow = {
	translationName?: string | null;
	tversion: string;
};

type GameRow = {
	name: string;
	image: string;
};

async function fetchGameNameAndImage(gameId: string): Promise<GameRow | null> {
	const rows = await db
		.select({ name: table.game.name, image: table.game.image })
		.from(table.game)
		.where(eq(table.game.id, gameId))
		.limit(1);
	return rows[0] ?? null;
}

/**
 * POST JSON sur une URL webhook Discord ; ne lève pas (journalise seulement).
 */
export async function executeDiscordWebhook(
	webhookUrl: string | null | undefined,
	payload: { content?: string; embeds?: DiscordEmbed[] }
): Promise<void> {
	const url = webhookUrl?.trim();
	if (!url) return;
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				content: payload.content ?? '',
				tts: false,
				embeds: payload.embeds ?? []
			}),
			signal: AbortSignal.timeout(15_000)
		});
		if (!res.ok) {
			const txt = await res.text().catch(() => '');
			console.warn('[discord-webhook] HTTP', res.status, txt.slice(0, 500));
		}
	} catch (e) {
		console.warn('[discord-webhook] envoi échoué:', e);
	}
}

/**
 * Soumission acceptée et appliquée (canal « updates ») : embed selon le type d’opération.
 * Les modifications de jeu (`submissionType === 'update'`) ne sont pas envoyées sur ce webhook.
 */
export async function sendDiscordWebhookUpdatesSubmissionApplied(args: {
	submissionId: string;
	submissionType: string;
	/** Données JSON de la soumission après {@link applySubmission} (contient original* si besoin). */
	dataJson: string;
	/** Type `translation` : la soumission modifiait une traduction existante (sinon = nouvelle traduction). */
	translationWasUpdate?: boolean;
	/** Ex. notes admin à l’acceptation (utilisé comme « raison » pour une suppression). */
	adminNotes?: string | null;
}): Promise<void> {
	const { updates } = await getWebhookUrls();
	if (!updates) return;
	if (args.submissionType === 'update') return;

	let data: Record<string, unknown>;
	try {
		data = JSON.parse(args.dataJson) as Record<string, unknown>;
	} catch {
		await executeDiscordWebhook(updates, {
			embeds: [
				{
					title: 'Soumission acceptée',
					description: 'Impossible de lire les données de la soumission.',
					color: 0x95a5a6,
					footer: { text: 'F95 France' }
				}
			]
		});
		return;
	}

	const gameId = typeof data.gameId === 'string' ? data.gameId : undefined;
	const game = data.game as GameRow | undefined;
	const originalGame = data.originalGame as GameRow | undefined;
	const translation = data.translation as TrRow | undefined;
	const originalTranslation = data.originalTranslation as TrRow | undefined;
	const originalTranslations = data.originalTranslations as TrRow[] | undefined;

	let resolvedGame: GameRow | null = game ?? originalGame ?? null;
	if (!resolvedGame && gameId) {
		resolvedGame = await fetchGameNameAndImage(gameId);
	}

	const gameName = resolvedGame?.name ?? '—';
	/** Image principale (sous les champs) — plus lisible que la vignette `thumbnail`. */
	const coverUrl = embedImageUrl(resolvedGame?.image);

	const baseFooter = { text: `F95 France · ${args.submissionId.slice(0, 8)}…` };

	const fields: { name: string; value: string; inline?: boolean }[] = [
		{ name: 'Nom du jeu', value: trimFieldValue(gameName), inline: false }
	];

	let title = 'Soumission acceptée';
	let color = 0x2ecc71;
	let embed: DiscordEmbed = { title, color, fields, footer: baseFooter };
	if (coverUrl) embed.image = { url: coverUrl };

	const st = args.submissionType;

	if (st === 'game') {
		const hasTr = translation && (translation.translationName || translation.tversion);
		title = hasTr ? 'Ajout de jeu et traduction' : 'Ajout de jeu';
		color = 0x2ecc71;
		if (hasTr) {
			fields.push(
				{
					name: 'Nom de la traduction',
					value: trimFieldValue(translation.translationName || '—', 200),
					inline: false
				},
				{
					name: 'Version de la traduction',
					value: trimFieldValue(translation.tversion ?? '—', 120),
					inline: true
				}
			);
		}
		embed = { ...embed, title, color };
	} else if (st === 'translation') {
		const isEdit = args.translationWasUpdate === true;
		title = isEdit ? 'Modification de traduction' : 'Ajout de traduction';
		color = isEdit ? 0x3498db : 0x2ecc71;

		const trNameVal =
			isEdit && originalTranslation && translation
				? originalTranslation.translationName === translation.translationName
					? trimFieldValue(translation.translationName || '—', 200)
					: trimFieldValue(
							`${originalTranslation.translationName || '—'} → ${translation.translationName || '—'}`,
							200
						)
				: trimFieldValue(translation?.translationName || '—', 200);
		fields.push({
			name: 'Nom de la traduction',
			value: trNameVal,
			inline: false
		});

		if (isEdit && originalTranslation && translation) {
			fields.push({
				name: 'Version de la traduction (avant → après)',
				value: trimFieldValue(`${originalTranslation.tversion} → ${translation.tversion}`, 200),
				inline: false
			});
		} else if (translation) {
			fields.push({
				name: 'Version de la traduction',
				value: trimFieldValue(translation.tversion ?? '—', 120),
				inline: true
			});
		}
		embed = { ...embed, title, color };
	} else if (st === 'delete') {
		title =
			originalTranslation && !originalGame ? 'Suppression de traduction' : 'Suppression de jeu';
		color = 0xe67e22;

		// Suppression traduction : JSON sans originalGame → jeu encore en base
		if (originalTranslation && gameId && !originalGame) {
			const g = await fetchGameNameAndImage(gameId);
			if (g) {
				fields[0] = { name: 'Nom du jeu', value: trimFieldValue(g.name), inline: false };
				const u = embedImageUrl(g.image);
				if (u) embed.image = { url: u };
			}
			fields.push(
				{
					name: 'Traduction',
					value: trimFieldValue(originalTranslation.translationName || '—', 200),
					inline: false
				},
				{
					name: 'Version de traduction',
					value: trimFieldValue(originalTranslation.tversion ?? '—', 300),
					inline: false
				}
			);
		} else if (originalGame) {
			fields[0] = { name: 'Nom du jeu', value: trimFieldValue(originalGame.name), inline: false };
			const u = embedImageUrl(originalGame.image);
			if (u) embed.image = { url: u };

			if (originalTranslations && originalTranslations.length > 0) {
				const lines = originalTranslations.map(
					(t, i) => `${i + 1}. ${t.translationName || 'Sans nom'} — trad ${t.tversion}`
				);
				fields.push({
					name: 'Traductions supprimées',
					value: trimFieldValue(lines.join('\n'), 900),
					inline: false
				});
			}
		}

		const reasonText =
			args.adminNotes?.trim() || (typeof data.reason === 'string' ? data.reason.trim() : '') || '—';
		fields.push({
			name: 'Raison / notes',
			value: trimFieldValue(reasonText, 900),
			inline: false
		});
		embed = { ...embed, title, color };
	}

	if (
		st === 'translation' &&
		args.translationWasUpdate === true &&
		translation &&
		originalTranslation
	) {
		if (
			!shouldNotifyTranslationModificationForUpdatesChannel(
				translation as Record<string, unknown>,
				originalTranslation as Record<string, unknown>
			)
		) {
			return;
		}
	}

	await executeDiscordWebhook(updates, { embeds: [embed] });
}

export type TranslatorVersionBumpLine = {
	gameName: string;
	translationName?: string | null;
	oldVersion: string;
	newVersion: string;
	discordMention?: string;
};

function buildAutoCheckVersionBumpFields(
	lines: TranslatorVersionBumpLine[]
): DiscordEmbed['fields'] {
	return lines.slice(0, 20).map((l) => {
		const tr = l.translationName?.trim();
		const name = trimFieldValue(tr ? `${l.gameName} — ${tr}` : l.gameName, 256);
		const ver = `${trimFieldValue(l.oldVersion || '—', 400)} → ${trimFieldValue(l.newVersion, 400)}`;
		const value = l.discordMention ? `${ver}\n${l.discordMention}` : ver;
		return {
			name,
			value: trimFieldValue(value, 1024),
			inline: false
		};
	});
}

async function sendAutoCheckVersionBumpEmbed(
	webhookUrl: string | null | undefined,
	lines: TranslatorVersionBumpLine[],
	footerText: string
): Promise<void> {
	if (!webhookUrl || lines.length === 0) return;
	const fields = buildAutoCheckVersionBumpFields(lines);
	await executeDiscordWebhook(webhookUrl, {
		embeds: [
			{
				title: 'Jeux mis à jour (Auto-Check)',
				color: 0x3498db,
				fields,
				author: { name: 'Auto-Check' },
				footer: { text: footerText }
			}
		]
	});
}

/** Auto-check : canal traducteurs (`DISCORD_WEBHOOK_TRANSLATORS`). */
export async function sendDiscordWebhookTranslatorsVersionBumps(
	lines: TranslatorVersionBumpLine[]
): Promise<void> {
	const { translators } = await getWebhookUrls();
	await sendAutoCheckVersionBumpEmbed(translators, lines, 'F95 France');
}

/** Auto-check : même embed que les traducteurs, canal relecteurs (`DISCORD_WEBHOOK_PROOFREADERS`). */
export async function sendDiscordWebhookProofreadersVersionBumps(
	lines: TranslatorVersionBumpLine[]
): Promise<void> {
	const { admin } = await getWebhookUrls();
	await sendAutoCheckVersionBumpEmbed(admin, lines, 'F95 France · Relecteurs');
}

/** Canal updates : annonce d'une montée de version détectée par l'auto-check. */
export async function sendDiscordWebhookUpdatesAutoCheckVersionBump(args: {
	gameName: string;
	translationName?: string | null;
	oldVersion?: string | null;
	newVersion: string;
}): Promise<void> {
	const { updates } = await getWebhookUrls();
	if (!updates) return;

	const trLabel = args.translationName?.trim() ? ` - ${args.translationName.trim()}` : '';
	await executeDiscordWebhook(updates, {
		embeds: [
			{
				title: 'Traduction mise à jour',
				color: 0x58b9ff,
				fields: [
					{
						name: 'Jeu',
						value: `${trimFieldValue(args.gameName, 200)}${trimFieldValue(trLabel, 200)}`,
						inline: false
					},
					{
						name: 'Version',
						value: `${args.oldVersion ?? '—'} -> ${args.newVersion}`,
						inline: false
					}
				],
				footer: { text: 'Auto-Check · F95 France' }
			}
		]
	});
}

/** Canal proofreaders : message libre (ex. alertes relecture). */
export async function sendDiscordWebhookProofreadersEmbed(embed: DiscordEmbed): Promise<void> {
	const { admin } = await getWebhookUrls();
	await executeDiscordWebhook(admin, { embeds: [embed] });
}

/** Canal admin : alerte lors de la création d'une soumission. */
export async function sendDiscordWebhookAdminNewSubmission(args: {
	submitterName: string;
	gameName?: string | null;
	gameImage?: string | null;
	gameId?: string | null;
}): Promise<void> {
	// On force le refresh ici pour éviter un cache stale après changement de config.
	const { admin } = await getWebhookUrls(true);
	if (!admin) {
		console.warn('[discord-webhook] webhook admin non configuré (soumission non envoyée)');
		return;
	}

	const submitter = args.submitterName.trim() || 'Utilisateur inconnu';
	let gameName = typeof args.gameName === 'string' ? args.gameName.trim() : '';
	let gameImage = typeof args.gameImage === 'string' ? args.gameImage.trim() : '';

	if ((!gameName || !gameImage) && args.gameId) {
		const game = await fetchGameNameAndImage(args.gameId);
		if (game) {
			if (!gameName) gameName = game.name;
			if (!gameImage) gameImage = game.image;
		}
	}

	await executeDiscordWebhook(admin, {
		content: undefined,
		embeds: [
			{
				description: 'Nouvelle soumission ajouté',
				color: 1345469,
				fields: [
					{
						name: 'Nom du jeu',
						value: gameName || '—'
					},
					{
						name: 'Nom du traducteur',
						value: submitter
					}
				],
				image: gameImage ? { url: gameImage } : undefined
			}
		]
	});
}
