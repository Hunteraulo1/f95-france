import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
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
	logs: string | null;
	translators: string | null;
	proofreaders: string | null;
};

let cached: { urls: WebhookUrls; at: number } | null = null;
const CACHE_MS = 60_000;

async function getWebhookUrls(): Promise<WebhookUrls> {
	const now = Date.now();
	if (cached && now - cached.at < CACHE_MS) {
		return cached.urls;
	}
	const rows = await db
		.select({
			discordWebhookUpdates: table.config.discordWebhookUpdates,
			discordWebhookLogs: table.config.discordWebhookLogs,
			discordWebhookTranslators: table.config.discordWebhookTranslators,
			discordWebhookProofreaders: table.config.discordWebhookProofreaders
		})
		.from(table.config)
		.where(eq(table.config.id, 'main'))
		.limit(1);
	const r = rows[0];
	const urls: WebhookUrls = {
		updates: r?.discordWebhookUpdates ?? null,
		logs: r?.discordWebhookLogs ?? null,
		translators: r?.discordWebhookTranslators ?? null,
		proofreaders: r?.discordWebhookProofreaders ?? null
	};
	cached = { urls, at: now };
	return urls;
}

function trimFieldValue(s: string, max = 1000): string {
	const t = s.trim();
	return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Discord n’accepte que des URLs absolues pour les images d’embed. */
function embedImageUrl(raw: string | null | undefined): string | undefined {
	if (!raw || typeof raw !== 'string') return undefined;
	const u = raw.trim();
	if (u.startsWith('http://') || u.startsWith('https://')) return u;
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

/** Erreur API / route (équivalent canal « logs » côté f95list-form). */
export async function sendDiscordWebhookLogsApiError(args: {
	method: string;
	route: string;
	status: number;
	username: string | null;
	userId: string | null;
}): Promise<void> {
	const { logs } = await getWebhookUrls();
	if (!logs) return;

	const color = args.status >= 500 ? 0xe74c3c : 0xf39c12;
	await executeDiscordWebhook(logs, {
		embeds: [
			{
				title: `${args.status} — ${args.method}`,
				color,
				fields: [
					{ name: 'Route', value: trimFieldValue(args.route, 900), inline: false },
					{
						name: 'Utilisateur',
						value: trimFieldValue(args.username ?? '—', 200),
						inline: true
					},
					{
						name: 'ID',
						value: trimFieldValue(args.userId ?? '—', 200),
						inline: true
					}
				],
				footer: { text: 'F95 France — logs' }
			}
		]
	});
}

/** Soumission acceptée et appliquée (canal « updates ») : embed détaillé selon le type d’opération. */
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
	} else if (st === 'update') {
		title = 'Modification de jeu';
		color = 0x3498db;
		if (originalGame && game) {
			const nameLine =
				originalGame.name !== game.name ? `${originalGame.name} → ${game.name}` : game.name;
			fields[0] = { name: 'Nom du jeu', value: trimFieldValue(nameLine), inline: false };
			const updateCover = embedImageUrl(game.image) ?? coverUrl;
			if (updateCover) embed.image = { url: updateCover };
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

	await executeDiscordWebhook(updates, { embeds: [embed] });
}

/** Auto-check / rappels traducteurs : liste de lignes « jeu → version » (comme sendTraductorWebhook). */
export async function sendDiscordWebhookTranslatorsVersionBumps(
	lines: { label: string; discordMention?: string }[]
): Promise<void> {
	const { translators } = await getWebhookUrls();
	if (!translators || lines.length === 0) return;

	const fields = lines.slice(0, 20).map((l) => ({
		name: trimFieldValue(l.label, 200),
		value: l.discordMention ? trimFieldValue(l.discordMention, 500) : '—',
		inline: false
	}));

	await executeDiscordWebhook(translators, {
		embeds: [
			{
				title: 'Jeux mis à jour (Auto-Check)',
				color: 0x3498db,
				fields,
				author: { name: 'Auto-Check' },
				footer: { text: 'F95 France' }
			}
		]
	});
}

/** Canal proofreaders : message libre (ex. alertes relecture). */
export async function sendDiscordWebhookProofreadersEmbed(embed: DiscordEmbed): Promise<void> {
	const { proofreaders } = await getWebhookUrls();
	await executeDiscordWebhook(proofreaders, { embeds: [embed] });
}
