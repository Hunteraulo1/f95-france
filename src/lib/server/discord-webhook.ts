import { getEffectiveConfig } from '$lib/server/app-config';
import { appLogWarn } from '$lib/server/app-log-bridge';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { privateEnv } from '$lib/server/private-env';
import { strTrim } from '$lib/server/translation-notify-rules';
import { absoluteUrl, siteOrigin } from '$lib/site';
import { resolveGameImageSrc } from '$lib/utils/game-image-url';
import { resolveGameThreadLink } from '$lib/utils/game-thread-link';
import { asc, eq } from 'drizzle-orm';

/**
 * Envoi vers les webhooks Discord dont les URL viennent des variables d’environnement
 * `DISCORD_WEBHOOK_*` (voir {@link getEffectiveConfig}).
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
		privateEnv('DISCORD_WEBHOOK_ADMIN')
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
		admin: cfg?.discordWebhookAdmin ?? null
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
 * n’envoyer que si la version de traduction ou la version de référence change.
 */
function shouldNotifyTranslationModificationForUpdatesChannel(
	next: Record<string, unknown>,
	prev: Record<string, unknown>
): boolean {
	const tversionChanged = strTrim(next.tversion) !== strTrim(prev.tversion);
	const versionChanged = strTrim(next.version) !== strTrim(prev.version);
	return tversionChanged || versionChanged;
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
	version?: string | null;
	tversion: string;
	translatorId?: string | null;
};

/** « Nom du jeu » ou « Nom du jeu - Nom de la traduction » si ce dernier est renseigné. */
function formatGameEmbedName(gameName: string, translationName?: string | null): string {
	const base = trimFieldValue(gameName || '—', 200);
	const tr = translationName?.trim();
	return tr ? `${base} - ${trimFieldValue(tr, 200)}` : base;
}

async function fetchTranslatorDisplayName(
	translatorId: string | null | undefined
): Promise<string | null> {
	const key = translatorId?.trim();
	if (!key) return null;

	const [byId] = await db
		.select({ name: table.translator.name })
		.from(table.translator)
		.where(eq(table.translator.id, key))
		.limit(1);
	if (byId?.name?.trim()) return byId.name.trim();

	const [byName] = await db
		.select({ name: table.translator.name })
		.from(table.translator)
		.where(eq(table.translator.name, key))
		.limit(1);
	if (byName?.name?.trim()) return byName.name.trim();

	// Nom libre stocké tel quel (ex. avant résolution UUID à l’acceptation)
	return key;
}

type GameRow = {
	name: string;
	image: string;
	link: string | null;
	threadId: number | null;
	website: string;
};

function resolveAppOriginForWebhooks(): string {
	return siteOrigin(privateEnv('SERVICE_URL_APP'));
}

function gameLinkEmbedField(gameLink: string | null | undefined) {
	if (!gameLink) return null;
	return {
		name: 'Lien du jeu',
		value: `[Ouvrir le fil](${gameLink})`,
		inline: false as const
	};
}

function dashboardGameEmbedField(gameId: string | null | undefined) {
	const id = gameId?.trim();
	if (!id) return null;
	const url = absoluteUrl(`/dashboard/manager/game/${id}`, resolveAppOriginForWebhooks());
	return {
		name: 'Page du jeu',
		value: `[Ouvrir dans le dashboard](${url})`,
		inline: false as const
	};
}

/** Remplace les champs « Nom du jeu » / « Lien du jeu » sans les dupliquer. */
function replaceGameEmbedFields(
	fields: { name: string; value: string; inline?: boolean }[],
	gameName: string,
	gameLink: string | null | undefined,
	translationName?: string | null
): { name: string; value: string; inline?: boolean }[] {
	const rest = fields.filter(
		(f) =>
			f.name !== 'Nom du jeu' &&
			f.name !== 'Lien du jeu' &&
			f.name !== 'Nom de la traduction' &&
			f.name !== 'Nom du traducteur'
	);
	const header: { name: string; value: string; inline?: boolean }[] = [
		{ name: 'Nom du jeu', value: formatGameEmbedName(gameName, translationName), inline: false }
	];
	const linkField = gameLinkEmbedField(gameLink);
	if (linkField) header.push(linkField);
	return [...header, ...rest];
}

function translatorEmbedField(translatorName: string) {
	return {
		name: 'Nom du traducteur',
		value: trimFieldValue(translatorName, 200),
		inline: false as const
	};
}

/** N’ajoute le champ que si un traducteur est encore assigné (pas de repli sur l’ancien état). */
async function appendTranslatorEmbedFieldIfPresent(
	fields: { name: string; value: string; inline?: boolean }[],
	translatorId: string | null | undefined
): Promise<void> {
	const name = await fetchTranslatorDisplayName(translatorId);
	if (name) fields.push(translatorEmbedField(name));
}

async function fetchSubmissionMetaForWebhook(
	submissionId: string,
	data: Record<string, unknown>
): Promise<{ gameId?: string; translationId?: string }> {
	const gameIdFromData = typeof data.gameId === 'string' ? data.gameId.trim() : '';
	const translationIdFromData =
		typeof data.translationId === 'string' ? data.translationId.trim() : '';

	if (gameIdFromData && translationIdFromData) {
		return { gameId: gameIdFromData, translationId: translationIdFromData };
	}

	const [sub] = await db
		.select({
			gameId: table.submission.gameId,
			translationId: table.submission.translationId
		})
		.from(table.submission)
		.where(eq(table.submission.id, submissionId))
		.limit(1);

	return {
		gameId: gameIdFromData || sub?.gameId || undefined,
		translationId: translationIdFromData || sub?.translationId || undefined
	};
}

async function fetchTranslationRowForWebhook(translationId: string): Promise<TrRow | null> {
	const [row] = await db
		.select({
			translationName: table.gameTranslation.translationName,
			version: table.gameTranslation.version,
			tversion: table.gameTranslation.tversion,
			translatorId: table.gameTranslation.translatorId
		})
		.from(table.gameTranslation)
		.where(eq(table.gameTranslation.id, translationId))
		.limit(1);
	return row ?? null;
}

function pickString(...values: unknown[]): string | null {
	for (const value of values) {
		if (typeof value === 'string' && value.trim()) return value.trim();
	}
	return null;
}

function mergeTranslationForWebhook(
	translation: TrRow | undefined,
	originalTranslation: TrRow | undefined,
	dbRow: TrRow | null
): { current: TrRow | undefined; original: TrRow | undefined } {
	const current: TrRow = {
		translationName:
			pickString(translation?.translationName) ?? pickString(dbRow?.translationName) ?? null,
		version: pickString(translation?.version) ?? pickString(dbRow?.version) ?? null,
		tversion: pickString(translation?.tversion) ?? pickString(dbRow?.tversion) ?? '—',
		translatorId: pickString(dbRow?.translatorId) ?? pickString(translation?.translatorId) ?? null
	};
	const original: TrRow | undefined = originalTranslation
		? {
				translationName:
					pickString(originalTranslation.translationName) ??
					pickString(dbRow?.translationName) ??
					null,
				version: pickString(originalTranslation.version) ?? pickString(dbRow?.version) ?? null,
				tversion: pickString(originalTranslation.tversion) ?? pickString(dbRow?.tversion) ?? '—',
				translatorId:
					pickString(originalTranslation.translatorId) ?? pickString(dbRow?.translatorId) ?? null
			}
		: undefined;
	return { current, original };
}

async function fetchGameForWebhook(gameId: string): Promise<GameRow | null> {
	const rows = await db
		.select({
			name: table.game.name,
			image: table.game.image,
			link: table.game.link,
			threadId: table.game.threadId,
			website: table.game.website
		})
		.from(table.game)
		.where(eq(table.game.id, gameId))
		.limit(1);
	return rows[0] ?? null;
}

function resolveGameLinkFromRow(game: GameRow | null | undefined): string | null {
	if (!game) return null;
	return resolveGameThreadLink({
		link: game.link,
		threadId: game.threadId,
		website: game.website
	});
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
			appLogWarn('notification', 'Discord webhook HTTP error', undefined, {
				status: res.status,
				body: txt.slice(0, 500)
			});
		}
	} catch (e) {
		appLogWarn('notification', 'Discord webhook envoi échoué', e);
	}
}

/**
 * Soumission acceptée et appliquée (canal « updates ») : embed selon le type d’opération.
 * Exclus : modifications de jeu (`update`) et pages traducteur (`translator_pages`).
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
	if (args.submissionType === 'update' || args.submissionType === 'translator_pages') return;

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

	const meta = await fetchSubmissionMetaForWebhook(args.submissionId, data);
	const gameId = meta.gameId;
	let translationId = meta.translationId;

	// Soumission « game » : translationId peut manquer dans le JSON d’origine
	if (!translationId && gameId && args.submissionType === 'game') {
		const [firstTr] = await db
			.select({ id: table.gameTranslation.id })
			.from(table.gameTranslation)
			.where(eq(table.gameTranslation.gameId, gameId))
			.orderBy(asc(table.gameTranslation.createdAt))
			.limit(1);
		translationId = firstTr?.id;
	}

	const game = data.game as GameRow | undefined;
	const originalGame = data.originalGame as GameRow | undefined;
	let translation = data.translation as TrRow | undefined;
	let originalTranslation = data.originalTranslation as TrRow | undefined;
	const originalTranslations = data.originalTranslations as TrRow[] | undefined;

	const dbTranslation = translationId ? await fetchTranslationRowForWebhook(translationId) : null;
	const merged = mergeTranslationForWebhook(translation, originalTranslation, dbTranslation);
	translation = merged.current;
	originalTranslation = merged.original;

	const partial = (game ?? originalGame) as Partial<GameRow> | undefined;
	let resolvedGame: GameRow | null = gameId ? await fetchGameForWebhook(gameId) : null;
	if (!resolvedGame && partial?.name) {
		resolvedGame = {
			name: partial.name,
			image: typeof partial.image === 'string' ? partial.image : '',
			link: partial.link ?? null,
			threadId: partial.threadId ?? null,
			website: partial.website ?? 'other'
		};
	} else if (resolvedGame && partial?.name) {
		resolvedGame = {
			...resolvedGame,
			name: partial.name,
			image: partial.image ?? resolvedGame.image
		};
	}

	const gameName = resolvedGame?.name ?? '—';
	const gameLink = resolveGameLinkFromRow(resolvedGame);
	/** Image principale (sous les champs) — plus lisible que la vignette `thumbnail`. */
	const coverUrl = embedImageUrl(resolvedGame?.image);

	const baseFooter = { text: `F95 France · ${args.submissionId.slice(0, 8)}…` };

	let fields: { name: string; value: string; inline?: boolean }[] = replaceGameEmbedFields(
		[],
		gameName,
		gameLink
	);

	let title = 'Soumission acceptée';
	let color = 0x2ecc71;
	let embed: DiscordEmbed = { title, color, fields, footer: baseFooter };
	if (coverUrl) embed.image = { url: coverUrl };

	const st = args.submissionType;

	if (st === 'game') {
		const hasTr = translation && (translation.translationName || translation.tversion);
		title = hasTr ? 'Ajout de jeu et traduction' : 'Ajout de jeu';
		color = 0x2ecc71;
		if (hasTr && translation) {
			fields = replaceGameEmbedFields(fields, gameName, gameLink, translation.translationName);
			await appendTranslatorEmbedFieldIfPresent(fields, translation.translatorId);
			fields.push({
				name: 'Version de la traduction',
				value: trimFieldValue(translation.tversion ?? '—', 120),
				inline: true
			});
		}
		embed = { ...embed, title, color, fields };
	} else if (st === 'translation') {
		const isEdit = args.translationWasUpdate === true;
		title = isEdit ? 'Modification de traduction' : 'Ajout de traduction';
		color = isEdit ? 0x3498db : 0x2ecc71;

		fields = replaceGameEmbedFields(
			fields,
			gameName,
			gameLink,
			translation?.translationName ?? originalTranslation?.translationName
		);
		await appendTranslatorEmbedFieldIfPresent(fields, translation?.translatorId);

		if (isEdit && originalTranslation && translation) {
			if (strTrim(translation.tversion) !== strTrim(originalTranslation.tversion)) {
				fields.push({
					name: 'Version de traduction (avant → après)',
					value: trimFieldValue(`${originalTranslation.tversion} → ${translation.tversion}`, 200),
					inline: false
				});
			}
			if (strTrim(translation.version) !== strTrim(originalTranslation.version)) {
				fields.push({
					name: 'Version de référence (avant → après)',
					value: trimFieldValue(
						`${originalTranslation.version ?? '—'} → ${translation.version ?? '—'}`,
						200
					),
					inline: false
				});
			}
		} else if (translation) {
			fields.push({
				name: 'Version de la traduction',
				value: trimFieldValue(translation.tversion ?? '—', 120),
				inline: true
			});
		}
		embed = { ...embed, title, color, fields };
	} else if (st === 'delete') {
		title =
			originalTranslation && !originalGame ? 'Suppression de traduction' : 'Suppression de jeu';
		color = 0xe67e22;

		// Suppression traduction : JSON sans originalGame → jeu encore en base
		if (originalTranslation && gameId && !originalGame) {
			const g = await fetchGameForWebhook(gameId);
			if (g) {
				const gLink = resolveGameLinkFromRow(g);
				fields = replaceGameEmbedFields(fields, g.name, gLink, originalTranslation.translationName);
				const u = embedImageUrl(g.image);
				if (u) embed.image = { url: u };
			}
			await appendTranslatorEmbedFieldIfPresent(fields, originalTranslation.translatorId);
			fields.push({
				name: 'Version de traduction',
				value: trimFieldValue(originalTranslation.tversion ?? '—', 300),
				inline: false
			});
		} else if (originalGame || (gameId && !originalTranslation)) {
			const og =
				(originalGame as GameRow | undefined) ??
				(gameId ? await fetchGameForWebhook(gameId) : null);
			if (og) {
				const ogLink = resolveGameLinkFromRow(og);
				fields = replaceGameEmbedFields(fields, og.name, ogLink);
				const u = embedImageUrl(og.image);
				if (u) embed.image = { url: u };
			}

			if (originalTranslations && originalTranslations.length > 0) {
				const lines = originalTranslations.map(
					(t, i) => `${i + 1}. ${t.translationName ? t.translationName + ' — ' : ''}${t.tversion}`
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
		embed = { ...embed, title, color, fields };
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
	gameId: string;
	gameName: string;
	gameImage?: string | null;
	translationName?: string | null;
	oldVersion: string;
	newVersion: string;
	discordMention?: string;
};

const AUTO_CHECK_EMBEDS_PER_MESSAGE = 10;

function buildAutoCheckVersionBumpEmbed(
	line: TranslatorVersionBumpLine,
	footerText: string
): DiscordEmbed {
	const tr = line.translationName?.trim();
	const ver = `${trimFieldValue(line.oldVersion || '—', 400)} → ${trimFieldValue(line.newVersion, 400)}`;
	const versionValue = line.discordMention ? `${ver}\n${line.discordMention}` : ver;
	const dashboardField = dashboardGameEmbedField(line.gameId);
	const embed: DiscordEmbed = {
		title: trimFieldValue(line.gameName, 256),
		color: 0x3498db,
		fields: [
			...(dashboardField ? [dashboardField] : []),
			...(tr ? [{ name: 'Traduction', value: trimFieldValue(tr, 256), inline: false }] : []),
			{ name: 'Version', value: trimFieldValue(versionValue, 1024), inline: false }
		],
		author: { name: 'Auto-Check' },
		footer: { text: footerText }
	};
	const coverUrl = embedImageUrl(line.gameImage);
	if (coverUrl) embed.image = { url: coverUrl };
	return embed;
}

async function sendAutoCheckVersionBumpEmbed(
	webhookUrl: string | null | undefined,
	lines: TranslatorVersionBumpLine[],
	footerText: string
): Promise<void> {
	if (!webhookUrl || lines.length === 0) return;
	const capped = lines.slice(0, 20);
	for (let i = 0; i < capped.length; i += AUTO_CHECK_EMBEDS_PER_MESSAGE) {
		const batch = capped.slice(i, i + AUTO_CHECK_EMBEDS_PER_MESSAGE);
		const embeds = batch.map((line) => buildAutoCheckVersionBumpEmbed(line, footerText));
		await executeDiscordWebhook(webhookUrl, {
			content: i === 0 && capped.length > 1 ? 'Jeux mis à jour (Auto-Check)' : undefined,
			embeds
		});
	}
}

/** Auto-check : canal traducteurs (`DISCORD_WEBHOOK_TRANSLATORS`). */
export async function sendDiscordWebhookTranslatorsVersionBumps(
	lines: TranslatorVersionBumpLine[],
	options?: { forceRefreshWebhookUrls?: boolean }
): Promise<number> {
	const { translators } = await getWebhookUrls(options?.forceRefreshWebhookUrls ?? false);
	await sendAutoCheckVersionBumpEmbed(translators, lines, 'F95 France');
	return lines.length;
}

/** Auto-check : même embed que les traducteurs, canal relecteurs (`DISCORD_WEBHOOK_ADMIN`). */
export async function sendDiscordWebhookProofreadersVersionBumps(
	lines: TranslatorVersionBumpLine[],
	options?: { forceRefreshWebhookUrls?: boolean }
): Promise<number> {
	const { admin } = await getWebhookUrls(options?.forceRefreshWebhookUrls ?? false);
	await sendAutoCheckVersionBumpEmbed(admin, lines, 'F95 France · Relecteurs');
	return lines.length;
}

/** Canal updates : annonce d'une montée de version détectée par l'auto-check. */
export async function sendDiscordWebhookUpdatesAutoCheckVersionBump(args: {
	gameName: string;
	gameImage?: string | null;
	gameLink?: string | null;
	translationName?: string | null;
	translatorId?: string | null;
	oldVersion?: string | null;
	newVersion: string;
}): Promise<void> {
	const { updates } = await getWebhookUrls();
	if (!updates) return;

	const linkField = gameLinkEmbedField(args.gameLink);
	const autoCheckFields: { name: string; value: string; inline?: boolean }[] = [
		{
			name: 'Nom du jeu',
			value: formatGameEmbedName(args.gameName, args.translationName),
			inline: false
		},
		...(linkField ? [linkField] : [])
	];
	await appendTranslatorEmbedFieldIfPresent(autoCheckFields, args.translatorId);
	autoCheckFields.push({
		name: 'Version',
		value: `${args.oldVersion ?? '—'} -> ${args.newVersion}`,
		inline: false
	});
	const embed: DiscordEmbed = {
		title: 'Traduction mise à jour',
		color: 0x58b9ff,
		fields: autoCheckFields,
		footer: { text: 'Auto-Check · F95 France' }
	};
	const coverUrl = embedImageUrl(args.gameImage);
	if (coverUrl) embed.image = { url: coverUrl };
	await executeDiscordWebhook(updates, { embeds: [embed] });
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
		appLogWarn('notification', 'Webhook admin Discord non configuré (soumission non envoyée)');
		return;
	}

	const submitter = args.submitterName.trim() || 'Utilisateur inconnu';
	let gameName = typeof args.gameName === 'string' ? args.gameName.trim() : '';
	let gameImage = typeof args.gameImage === 'string' ? args.gameImage.trim() : '';

	if ((!gameName || !gameImage) && args.gameId) {
		const game = await fetchGameForWebhook(args.gameId);
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
						name: 'Soumis par',
						value: submitter
					}
				],
				image: gameImage ? { url: gameImage } : undefined
			}
		]
	});
}
