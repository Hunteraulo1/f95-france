import type { AppLogSource } from '$lib/logs/app-log';
import { appLogWarn } from '$lib/server/app-log-bridge';
import { logApp } from '$lib/server/app-logger';
import {
	AutoCheckRunRecorder,
	type AutoCheckTriggerSource
} from '$lib/server/auto-check-run-recorder';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { sendDiscordBotTranslatorVersionBumpDm } from '$lib/server/discord-bot';
import {
	sendDiscordWebhookProofreadersVersionBumps,
	sendDiscordWebhookTranslatorsVersionBumps,
	sendDiscordWebhookUpdatesAutoCheckVersionBump,
	type TranslatorVersionBumpLine
} from '$lib/server/discord-webhook';
import { resolveGameDescriptionFields } from '$lib/server/game-description-fr';
import { coerceGameEngineType } from '$lib/server/game-engine-type';
import { recordTranslationChangeInUpdateHistory } from '$lib/server/game-updates';
import { syncDbToSpreadsheetBulk } from '$lib/server/google-sheets-sync';
import type { ScrapedThreadGame } from '$lib/server/scrape';
import { scrapedFromF95Thread } from '$lib/server/scrape/f95';
import { checkF95ScraperThreads, F95_SCRAPER_CHECK_BATCH } from '$lib/server/scrape/f95-scraper';
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

export type AutoCheckIssue = {
	stage:
		| 'checker_fetch'
		| 'checker_payload'
		| 'scrape'
		| 'dm_translator'
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

type F95ThreadCheck = {
	/** Version F95 actuelle ; pour un thread inchangé, celle déjà enregistrée sur la fiche. */
	version: string | null;
	lastChange: number;
	/** Données du thread, seulement quand il a changé depuis `f95LastChange`. */
	scraped: ScrapedThreadGame | null;
};

/**
 * Remplace `checker.php` (bloqué par Cloudflare) : passe par le scraper, qui ne renvoie les
 * données que des threads modifiés depuis leur `f95LastChange`.
 */
async function fetchF95Checks(
	games: { threadId: number; gameVersion: string | null; f95LastChange: number | null }[],
	issues: AutoCheckIssue[],
	logSource: AppLogSource | string
): Promise<Map<number, F95ThreadCheck>> {
	const checks = new Map<number, F95ThreadCheck>();
	const gameByThreadId = new Map(games.map((g) => [g.threadId, g]));

	for (let i = 0; i < games.length; i += F95_SCRAPER_CHECK_BATCH) {
		const batch = games.slice(i, i + F95_SCRAPER_CHECK_BATCH);
		try {
			const results = await checkF95ScraperThreads(
				batch.map((g) => ({ id: g.threadId, lastChange: g.f95LastChange }))
			);
			for (const r of results) {
				if (r.result === 'changed') {
					checks.set(r.id, {
						version: r.thread.version,
						lastChange: r.lastChange,
						scraped: scrapedFromF95Thread(r.thread, r.status)
					});
				} else if (r.result === 'unchanged') {
					checks.set(r.id, {
						version: gameByThreadId.get(r.id)?.gameVersion ?? null,
						lastChange: r.lastChange,
						scraped: null
					});
				} else if (r.result === 'failed') {
					issues.push({
						stage: 'checker_payload',
						message: `Vérification F95 échouée (${r.kind})`,
						threadId: r.id,
						detail: r.message
					});
				}
				// `not_found` : thread supprimé ou privé, ignoré comme avec checker.php.
			}
		} catch (error) {
			// Le scraper est externe : une panne ne doit pas faire tomber tout l'auto-check.
			appLogWarn(logSource, 'auto-check : appel scraper échoué', error);
			issues.push({
				stage: 'checker_fetch',
				message: 'Erreur réseau/JSON scraper F95',
				detail: `${error instanceof Error ? error.message : String(error)} (threads=${batch.map((g) => g.threadId).join(',')})`
			});
		}
	}

	return checks;
}

export type AutoCheckResult = {
	scannedGames: number;
	updatedGames: number;
	updatedTranslations: number;
	disabledAlignedGames: number;
	translatorDmsSent: number;
	translatorWebhooksSent: number;
	proofreaderWebhooksSent: number;
	issues: AutoCheckIssue[];
};

export type RunAutoCheckVersionsOptions = {
	/** Recharge les URL webhook depuis l’env (utile après changement de config / exécution manuelle). */
	refreshWebhookUrls?: boolean;
	/** Source affichée dans les logs applicatifs. */
	logSource?: AppLogSource;
	/** Origine du déclenchement pour l’historique. */
	triggerSource?: AutoCheckTriggerSource;
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
	const startedAtMs = Date.now();
	const refreshWebhookUrls = options?.refreshWebhookUrls ?? false;
	const logSource = options?.logSource ?? 'worker';
	const triggerSource: AutoCheckTriggerSource =
		options?.triggerSource ?? (logSource === 'cron' ? 'cron' : 'manual');
	const recorder = await AutoCheckRunRecorder.start(triggerSource);
	const issues: AutoCheckIssue[] = [];

	const finishRun = async (result: AutoCheckResult) => {
		logApp({
			level: result.issues.length > 0 ? 'warn' : 'info',
			source: logSource,
			message: 'auto-check versions : terminé',
			meta: {
				...result,
				issueCount: result.issues.length
			}
		});
		await recorder?.finish(result, Date.now() - startedAtMs);
		return result;
	};

	logApp({
		level: 'info',
		source: logSource,
		message: 'auto-check versions : démarrage',
		meta: { refreshWebhookUrls, triggerSource }
	});

	try {
		const rows = await db
			.select({
				gameId: table.game.id,
				gameName: table.game.name,
				gameImage: table.game.image,
				gameLink: table.game.link,
				gameWebsite: table.game.website,
				gameVersion: table.game.gameVersion,
				gameF95LastChange: table.game.f95LastChange,
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
				translatorDmsSent: 0,
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
			return await finishRun(emptyResult);
		}

		const uniqueByGame = new Map<
			string,
			{
				gameId: string;
				gameName: string;
				gameImage: string | null;
				gameLink: string | null;
				gameVersion: string | null;
				f95LastChange: number | null;
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
				f95LastChange: row.gameF95LastChange,
				threadId: row.threadId,
				threadUrl: resolveGameThreadLink({
					link: row.gameLink,
					threadId: row.threadId,
					website: row.gameWebsite
				})
			});
		}

		const checks = await fetchF95Checks(Array.from(uniqueByGame.values()), issues, logSource);
		const versions = new Map(Array.from(checks, ([threadId, c]) => [threadId, c.version]));

		type UniqueGameRow = {
			gameId: string;
			gameName: string;
			gameImage: string | null;
			gameLink: string | null;
			gameVersion: string | null;
			f95LastChange: number | null;
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

		// Threads modifiés sans montée de version : on retient tout de suite le nouveau timestamp.
		// Les jeux à monter de version l'enregistrent avec leur nouvelle version, plus bas : si le
		// traitement s'interrompt avant, ils seront revérifiés au passage suivant.
		const changedGameIdSet = new Set(changedGames.map((g) => g.gameId));
		for (const g of uniqueByGame.values()) {
			const check = checks.get(g.threadId);
			if (!check || changedGameIdSet.has(g.gameId) || check.lastChange === g.f95LastChange) {
				continue;
			}
			await db
				.update(table.game)
				.set({ f95LastChange: check.lastChange })
				.where(eq(table.game.id, g.gameId));
		}

		if (changedGames.length === 0) {
			return await finishRun({
				scannedGames: uniqueByGame.size,
				updatedGames: 0,
				updatedTranslations: 0,
				disabledAlignedGames: alignedGames.length,
				translatorDmsSent: 0,
				translatorWebhooksSent: 0,
				proofreaderWebhooksSent: 0,
				issues
			});
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
				and(
					inArray(table.gameTranslation.gameId, changedGameIds),
					eq(table.gameTranslation.ac, true)
				)
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
						discordId: table.translator.discordId,
						discordNotificationsEnabled: table.translator.discordNotificationsEnabled
					})
					.from(table.translator)
					.where(inArray(table.translator.id, staffIds))
			: [];
		const staffMentionById = new Map(
			staffRows.map((s) => [s.id, s.discordId ? `<@${s.discordId}>` : undefined] as const)
		);
		const staffDiscordIdById = new Map(staffRows.map((s) => [s.id, s.discordId] as const));
		/** Le traducteur a désactivé lui-même le MP + le repli canal pour ses notifications. */
		const staffDiscordNotifDisabledById = new Set(
			staffRows.filter((s) => !s.discordNotificationsEnabled).map((s) => s.id)
		);
		const translatorWebhookLines: TranslatorVersionBumpLine[] = [];
		const proofreaderWebhookLines: TranslatorVersionBumpLine[] = [];
		/** Lignes « montée de version » groupées par traducteur, à envoyer en MP en priorité. */
		const translatorLinesByTranslatorId = new Map<string, TranslatorVersionBumpLine[]>();

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
					f95LastChange: checks.get(game.threadId)?.lastChange ?? game.f95LastChange,
					updatedAt: new Date()
				})
				.where(eq(table.game.id, game.gameId));

			await syncAcTranslationsToCheckerVersion(game.gameId, newVersion);

			recorder?.recordGameUpdate({
				gameId: game.gameId,
				gameName: game.gameName,
				threadId: game.threadId,
				oldVersion: game.gameVersion,
				newVersion,
				updatedTranslations: bumpTranslations.filter((r) => r.gameId === game.gameId).length
			});

			// Pas de données si le thread n'a pas bougé (seules les traductions étaient désalignées).
			const scraped = checks.get(game.threadId)?.scraped;
			if (scraped) {
				try {
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
					appLogWarn(logSource, 'auto-check : mise à jour depuis le scrape échouée', error, {
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
				const translatorLine: TranslatorVersionBumpLine = {
					gameId: game.gameId,
					gameName: game.gameName,
					gameImage: game.gameImage,
					translationName: t.translationName,
					oldVersion: game.gameVersion ?? '—',
					newVersion,
					discordMention: t.translatorId ? staffMentionById.get(t.translatorId) : undefined,
					translatorId: t.translatorId
				};
				if (t.translatorId && staffDiscordNotifDisabledById.has(t.translatorId)) {
					// Le traducteur a coupé ses notifications Discord (MP + repli canal) : on n'envoie rien.
				} else if (t.translatorId) {
					const bucket = translatorLinesByTranslatorId.get(t.translatorId) ?? [];
					bucket.push(translatorLine);
					translatorLinesByTranslatorId.set(t.translatorId, bucket);
				} else {
					translatorWebhookLines.push(translatorLine);
				}
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

			// Parité avec le webhook updates : matérialiser le bump de version intégrée
			// comme une ligne `update` visible dans /updates. On enregistre un changement
			// de traduction (delta de version, old -> new) ; `game.gameVersion` est encore
			// l'ancienne valeur ici, ce qui pose l'historique `entity='translation'`
			// requis par la portée « featured ».
			if (isActualVersionBump && integratedRows.length > 0) {
				const integrated = integratedRows[0];
				try {
					await recordTranslationChangeInUpdateHistory(game.gameId, {
						translationId: integrated.translationId,
						before: { version: game.gameVersion },
						after: { version: newVersion },
						updateKind: 'update'
					});
				} catch (error) {
					appLogWarn(logSource, 'auto-check : ligne update non créée', error, {
						gameId: game.gameId
					});
				}
			}
		}

		let translatorDmsSent = 0;
		for (const [translatorId, lines] of translatorLinesByTranslatorId) {
			const discordId = staffDiscordIdById.get(translatorId);
			let delivered = false;
			if (discordId) {
				try {
					const dmResult = await sendDiscordBotTranslatorVersionBumpDm(discordId, lines);
					delivered = dmResult.ok;
					if (!dmResult.ok && !dmResult.blocked) {
						issues.push({
							stage: 'dm_translator',
							message: 'MP traducteur échoué (repli sur le canal)',
							detail: dmResult.error
						});
					}
				} catch (error) {
					issues.push({
						stage: 'dm_translator',
						message: 'MP traducteur échoué (repli sur le canal)',
						detail: error instanceof Error ? error.message : String(error)
					});
				}
			}
			if (delivered) {
				translatorDmsSent += lines.length;
			} else {
				// Pas de discordId, ou MP impossible (bloqué / erreur) : on retombe sur le canal.
				translatorWebhookLines.push(...lines);
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
			translatorDmsSent,
			translatorWebhooksSent,
			proofreaderWebhooksSent,
			issues
		};

		return await finishRun(result);
	} catch (error) {
		await recorder?.fail(error);
		throw error;
	}
}
