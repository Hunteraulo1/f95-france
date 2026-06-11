import type { AppLogSource } from '$lib/logs/app-log';
import { appLogWarn } from '$lib/server/app-log-bridge';
import { logApp } from '$lib/server/app-logger';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	sendDiscordWebhookProofreadersVersionBumps,
	sendDiscordWebhookTranslatorsVersionBumps,
	sendDiscordWebhookUpdatesAutoCheckVersionBump,
	type TranslatorVersionBumpLine
} from '$lib/server/discord-webhook';
import { resolveGameDescriptionFields } from '$lib/server/game-description-fr';
import { coerceGameEngineType } from '$lib/server/game-engine-type';
import { syncDbToSpreadsheetBulk } from '$lib/server/google-sheets-sync';
import { scrapeF95Thread, type ScrapedThreadGame } from '$lib/server/scrape';
import { syncAcTranslationsToCheckerVersion } from '$lib/server/translation-ac-status';
import {
	shouldNotifyTranslatorOnAutoCheckVersionBump,
	tradVerIndicatesIntegrated
} from '$lib/server/translation-notify-rules';
import {
	hasF95CheckerGameVersionChange,
	isF95CheckerVersionAligned,
	needsF95VersionBump,
	normalizeCheckerVersion
} from '$lib/utils/f95-checker-alignment';
import { resolveGameThreadLink } from '$lib/utils/game-thread-link';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';

type CheckerResponse = {
	status: 'ok' | 'error' | string;
	msg: Record<string, string> | string;
};

export type AutoCheckIssue = {
	stage:
		| 'checker_fetch'
		| 'checker_payload'
		| 'scrape'
		| 'webhook_translators'
		| 'webhook_proofreaders'
		| 'webhook_updates'
		| 'google_sheets';
	message: string;
	gameId?: string;
	gameName?: string;
	threadId?: number;
	detail?: string;
};

const CHECKER_URL = 'https://f95zone.to/sam/checker.php?threads=';
const USER_AGENT =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) f95-france/1.0';

async function fetchF95Versions(
	threadIds: number[],
	issues: AutoCheckIssue[],
	logSource: AppLogSource | string
): Promise<Map<number, string>> {
	const versions = new Map<number, string>();
	if (threadIds.length === 0) return versions;

	for (let i = 0; i < threadIds.length; i += 100) {
		const batch = threadIds.slice(i, i + 100);
		const url = `${CHECKER_URL}${batch.join(',')}`;
		try {
			const res = await fetch(url, {
				headers: { 'User-Agent': USER_AGENT }
			});
			if (!res.ok) {
				issues.push({
					stage: 'checker_fetch',
					message: `Réponse HTTP ${res.status} du checker`,
					detail: `batch=${batch.join(',')}`
				});
				continue;
			}

			const json = (await res.json()) as CheckerResponse;
			if (json.status !== 'ok' || typeof json.msg !== 'object' || json.msg === null) {
				issues.push({
					stage: 'checker_payload',
					message: 'Payload checker invalide',
					detail: `batch=${batch.join(',')}`
				});
				continue;
			}

			for (const [threadIdRaw, version] of Object.entries(json.msg)) {
				const threadId = Number.parseInt(threadIdRaw, 10);
				if (!Number.isFinite(threadId) || typeof version !== 'string') continue;
				versions.set(threadId, version);
			}
		} catch (error) {
			// Le checker F95 est externe : une erreur réseau/JSON ne doit pas faire tomber tout l'auto-check.
			appLogWarn(logSource, 'auto-check : fetch checker échoué', error);
			issues.push({
				stage: 'checker_fetch',
				message: 'Erreur réseau/JSON checker',
				detail: error instanceof Error ? error.message : String(error)
			});
			continue;
		}
	}

	return versions;
}

export type AutoCheckResult = {
	scannedGames: number;
	updatedGames: number;
	updatedTranslations: number;
	disabledAlignedGames: number;
	translatorWebhooksSent: number;
	proofreaderWebhooksSent: number;
	issues: AutoCheckIssue[];
};

export type RunAutoCheckVersionsOptions = {
	/** Recharge les URL webhook depuis l’env (utile après changement de config / exécution manuelle). */
	refreshWebhookUrls?: boolean;
	/** Source affichée dans les logs applicatifs. */
	logSource?: AppLogSource;
};

/**
 * Champs `game` que l’auto-check peut écraser après un scrape F95.
 * `name` et `description` sont exclus : le titre du fil peut changer sans refléter la fiche locale.
 */
function autoCheckGamePatchFromScrape(scraped: ScrapedThreadGame) {
	return {
		tags: scraped.tags ?? undefined,
		image: scraped.image ?? undefined,
		updatedAt: new Date()
	};
}

/** API POST /api/cron/check-version / bouton dev : met à jour `gameVersion`, `tags`, `image` et le moteur des traductions ; ne modifie pas `game.name`. */
export async function runAutoCheckVersions(
	options?: RunAutoCheckVersionsOptions
): Promise<AutoCheckResult> {
	const refreshWebhookUrls = options?.refreshWebhookUrls ?? false;
	const logSource = options?.logSource ?? 'worker';
	const issues: AutoCheckIssue[] = [];

	logApp({
		level: 'info',
		source: logSource,
		message: 'auto-check versions : démarrage',
		meta: { refreshWebhookUrls }
	});

	const rows = await db
		.select({
			gameId: table.game.id,
			gameName: table.game.name,
			gameImage: table.game.image,
			gameLink: table.game.link,
			gameWebsite: table.game.website,
			gameVersion: table.game.gameVersion,
			threadId: table.game.threadId,
			translationId: table.gameTranslation.id,
			translationName: table.gameTranslation.translationName,
			version: table.gameTranslation.version,
			tversion: table.gameTranslation.tversion,
			tname: table.gameTranslation.tname,
			ac: table.gameTranslation.ac,
			translatorId: table.gameTranslation.translatorId,
			proofreaderId: table.gameTranslation.proofreaderId
		})
		.from(table.gameTranslation)
		.innerJoin(table.game, eq(table.game.id, table.gameTranslation.gameId))
		.where(
			and(
				eq(table.game.website, 'f95z'),
				eq(table.game.gameAutoCheck, true),
				eq(table.gameTranslation.ac, true),
				isNotNull(table.game.threadId)
			)
		);

	if (rows.length === 0) {
		const emptyResult = {
			scannedGames: 0,
			updatedGames: 0,
			updatedTranslations: 0,
			disabledAlignedGames: 0,
			translatorWebhooksSent: 0,
			proofreaderWebhooksSent: 0,
			issues
		};
		logApp({
			level: 'info',
			source: logSource,
			message: 'auto-check versions : aucune traduction à scanner',
			meta: emptyResult
		});
		return emptyResult;
	}

	const uniqueByGame = new Map<
		string,
		{
			gameId: string;
			gameName: string;
			gameImage: string | null;
			gameLink: string | null;
			gameVersion: string | null;
			threadId: number;
			threadUrl: string | null;
		}
	>();
	for (const row of rows) {
		if (row.threadId == null) continue;
		uniqueByGame.set(row.gameId, {
			gameId: row.gameId,
			gameName: row.gameName,
			gameImage: row.gameImage,
			gameLink: row.gameLink,
			gameVersion: row.gameVersion,
			threadId: row.threadId,
			threadUrl: resolveGameThreadLink({
				link: row.gameLink,
				threadId: row.threadId,
				website: row.gameWebsite
			})
		});
	}

	const versions = await fetchF95Versions(
		Array.from(uniqueByGame.values()).map((g) => g.threadId),
		issues,
		logSource
	);

	type UniqueGameRow = {
		gameId: string;
		gameName: string;
		gameImage: string | null;
		gameLink: string | null;
		gameVersion: string | null;
		threadId: number;
		threadUrl: string | null;
	};

	const gameTranslationsFor = (gameId: string) =>
		rows.filter((r) => r.gameId === gameId).map((r) => ({ ac: r.ac, version: r.version }));

	const gameNeedsCheckerBump = (g: UniqueGameRow) =>
		needsF95VersionBump(versions.get(g.threadId), g.gameVersion, gameTranslationsFor(g.gameId));

	const gameIsCheckerAligned = (g: UniqueGameRow) =>
		isF95CheckerVersionAligned(
			versions.get(g.threadId),
			g.gameVersion,
			gameTranslationsFor(g.gameId)
		);

	const changedGames = Array.from(uniqueByGame.values()).filter(gameNeedsCheckerBump);
	const alignedGames = Array.from(uniqueByGame.values()).filter(
		(g) => !gameNeedsCheckerBump(g) && gameIsCheckerAligned(g)
	);

	if (changedGames.length === 0) {
		return {
			scannedGames: uniqueByGame.size,
			updatedGames: 0,
			updatedTranslations: 0,
			disabledAlignedGames: alignedGames.length,
			translatorWebhooksSent: 0,
			proofreaderWebhooksSent: 0,
			issues
		};
	}

	const changedGameIds = changedGames.map((g) => g.gameId);
	const gameDescriptionRows =
		changedGameIds.length > 0
			? await db
					.select({
						id: table.game.id,
						description: table.game.description,
						descriptionFr: table.game.descriptionFr
					})
					.from(table.game)
					.where(inArray(table.game.id, changedGameIds))
			: [];
	const descriptionByGameId = new Map(
		gameDescriptionRows.map((row) => [
			row.id,
			{ description: row.description, descriptionFr: row.descriptionFr }
		])
	);
	const impactedTranslations = rows.filter((r) => changedGameIds.includes(r.gameId));
	const bumpTranslations = await db
		.select({
			translationId: table.gameTranslation.id,
			gameId: table.gameTranslation.gameId,
			translationName: table.gameTranslation.translationName,
			version: table.gameTranslation.version,
			tversion: table.gameTranslation.tversion,
			tname: table.gameTranslation.tname,
			status: table.gameTranslation.status,
			translatorAlertsEnabled: table.gameTranslation.translatorAlertsEnabled,
			ac: table.gameTranslation.ac,
			translatorId: table.gameTranslation.translatorId,
			proofreaderId: table.gameTranslation.proofreaderId
		})
		.from(table.gameTranslation)
		.where(
			and(inArray(table.gameTranslation.gameId, changedGameIds), eq(table.gameTranslation.ac, true))
		);
	const staffIds = Array.from(
		new Set(
			bumpTranslations.flatMap((r) =>
				[r.translatorId, r.proofreaderId].filter((v): v is string => typeof v === 'string')
			)
		)
	);
	const staffRows = staffIds.length
		? await db
				.select({
					id: table.translator.id,
					name: table.translator.name,
					discordId: table.translator.discordId
				})
				.from(table.translator)
				.where(inArray(table.translator.id, staffIds))
		: [];
	const staffMentionById = new Map(
		staffRows.map((s) => [s.id, s.discordId ? `<@${s.discordId}>` : undefined] as const)
	);
	const translatorWebhookLines: TranslatorVersionBumpLine[] = [];
	const proofreaderWebhookLines: TranslatorVersionBumpLine[] = [];

	for (const game of changedGames) {
		const newVersion = normalizeCheckerVersion(versions.get(game.threadId));
		if (!newVersion) continue;

		const isActualVersionBump = hasF95CheckerGameVersionChange(
			versions.get(game.threadId),
			game.gameVersion
		);
		await db
			.update(table.game)
			.set({
				gameVersion: newVersion,
				updatedAt: new Date()
			})
			.where(eq(table.game.id, game.gameId));

		await syncAcTranslationsToCheckerVersion(game.gameId, newVersion);

		try {
			const scraped = await scrapeF95Thread(game.threadId);
			if (scraped.image?.trim()) {
				game.gameImage = scraped.image.trim();
			}
			const currentDesc = descriptionByGameId.get(game.gameId);
			const nextDescription = scraped.description?.trim()
				? scraped.description.trim()
				: (currentDesc?.description ?? null);
			const descFields = await resolveGameDescriptionFields({
				description: nextDescription,
				previousDescription: currentDesc?.description ?? null,
				previousDescriptionFr: currentDesc?.descriptionFr ?? null,
				autoTranslate: Boolean(scraped.description?.trim())
			});
			await db
				.update(table.game)
				.set({
					...autoCheckGamePatchFromScrape(scraped),
					description: descFields.description,
					descriptionFr: descFields.descriptionFr
				})
				.where(eq(table.game.id, game.gameId));
			if (scraped.gameType) {
				const gt = coerceGameEngineType(scraped.gameType);
				await db
					.update(table.gameTranslation)
					.set({ gameType: gt, updatedAt: new Date() })
					.where(eq(table.gameTranslation.gameId, game.gameId));
			}
		} catch (error) {
			appLogWarn(logSource, 'auto-check : scrape non bloquant échoué', error, {
				gameId: game.gameId,
				threadId: game.threadId
			});
			issues.push({
				stage: 'scrape',
				message: 'Scrape F95 non bloquant échoué',
				gameId: game.gameId,
				gameName: game.gameName,
				threadId: game.threadId,
				detail: error instanceof Error ? error.message : String(error)
			});
		}

		for (const t of bumpTranslations.filter((r) => r.gameId === game.gameId)) {
			// Sécurité : ne jamais notifier une traduction dont l'auto-check n'est plus actif.
			if (!t.ac) continue;
			if (tradVerIndicatesIntegrated(t.tversion, t.tname)) continue;
			if (
				!shouldNotifyTranslatorOnAutoCheckVersionBump(
					{
						status: t.status,
						translatorAlertsEnabled: t.translatorAlertsEnabled,
						version: newVersion,
						tversion: t.tversion,
						tname: t.tname
					},
					newVersion
				)
			) {
				continue;
			}
			if (!isActualVersionBump) continue;
			translatorWebhookLines.push({
				gameId: game.gameId,
				gameName: game.gameName,
				gameImage: game.gameImage,
				translationName: t.translationName,
				oldVersion: game.gameVersion ?? '—',
				newVersion,
				discordMention: t.translatorId ? staffMentionById.get(t.translatorId) : undefined
			});
			if (t.proofreaderId && t.status !== 'abandoned') {
				proofreaderWebhookLines.push({
					gameId: game.gameId,
					gameName: game.gameName,
					gameImage: game.gameImage,
					translationName: t.translationName,
					oldVersion: game.gameVersion ?? '—',
					newVersion,
					discordMention: staffMentionById.get(t.proofreaderId)
				});
			}
		}

		const integratedRows = impactedTranslations.filter(
			(t) => t.gameId === game.gameId && t.tname === 'integrated'
		);
		for (const t of integratedRows) {
			if (!isActualVersionBump) continue;
			try {
				await sendDiscordWebhookUpdatesAutoCheckVersionBump({
					gameName: game.gameName,
					gameImage: game.gameImage,
					gameLink: game.threadUrl,
					translationName: t.translationName,
					translatorId: t.translatorId,
					oldVersion: game.gameVersion,
					newVersion
				});
			} catch (error) {
				issues.push({
					stage: 'webhook_updates',
					message: 'Webhook updates auto-check échoué',
					gameId: game.gameId,
					gameName: game.gameName,
					detail: error instanceof Error ? error.message : String(error)
				});
			}
		}
	}

	let translatorWebhooksSent = 0;
	let proofreaderWebhooksSent = 0;
	if (translatorWebhookLines.length > 0) {
		try {
			translatorWebhooksSent = await sendDiscordWebhookTranslatorsVersionBumps(
				translatorWebhookLines,
				{ forceRefreshWebhookUrls: refreshWebhookUrls }
			);
		} catch (error) {
			issues.push({
				stage: 'webhook_translators',
				message: 'Webhook traducteurs échoué',
				detail: error instanceof Error ? error.message : String(error)
			});
		}
	}
	if (proofreaderWebhookLines.length > 0) {
		try {
			proofreaderWebhooksSent = await sendDiscordWebhookProofreadersVersionBumps(
				proofreaderWebhookLines,
				{ forceRefreshWebhookUrls: refreshWebhookUrls }
			);
		} catch (error) {
			issues.push({
				stage: 'webhook_proofreaders',
				message: 'Webhook relecteurs échoué',
				detail: error instanceof Error ? error.message : String(error)
			});
		}
	}

	// Une seule synchro bulk évite les lectures répétées (et les 429 quota/minute).
	try {
		await syncDbToSpreadsheetBulk();
	} catch (err) {
		appLogWarn('sheets-sync', 'auto-check bulk sync failed', err);
		issues.push({
			stage: 'google_sheets',
			message: 'Sync Google Sheets bulk échouée',
			detail: err instanceof Error ? err.message : String(err)
		});
	}

	const result = {
		scannedGames: uniqueByGame.size,
		updatedGames: changedGames.length,
		updatedTranslations: impactedTranslations.length,
		disabledAlignedGames: alignedGames.length,
		translatorWebhooksSent,
		proofreaderWebhooksSent,
		issues
	};

	logApp({
		level: result.issues.length > 0 ? 'warn' : 'info',
		source: logSource,
		message: 'auto-check versions : terminé',
		meta: {
			...result,
			issueCount: result.issues.length
		}
	});

	return result;
}
