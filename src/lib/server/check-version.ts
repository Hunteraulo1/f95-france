import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
  sendDiscordWebhookProofreadersVersionBumps,
  sendDiscordWebhookTranslatorsVersionBumps,
  sendDiscordWebhookUpdatesAutoCheckVersionBump,
  type TranslatorVersionBumpLine
} from '$lib/server/discord-webhook';
import { coerceGameEngineType } from '$lib/server/game-engine-type';
import { touchGameUpdatedToday } from '$lib/server/game-updates';
import { syncDbToSpreadsheetBulk } from '$lib/server/google-sheets-sync';
import { scrapeF95Thread, type ScrapedF95Game } from '$lib/server/scrape/f95';
import { shouldNotifyTranslatorOnAutoCheckVersionBump } from '$lib/server/translation-notify-rules';
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
	issues: AutoCheckIssue[]
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
			// Le checker F95 est externe : une erreur réseau/JSON ne doit pas faire tomber tout le cron.
			console.warn('[auto-check] fetch checker non bloquant échoué:', error);
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

type AutoCheckResult = {
	scannedGames: number;
	updatedGames: number;
	updatedTranslations: number;
	issues: AutoCheckIssue[];
};

/**
 * Champs `game` que l’auto-check peut écraser après un scrape F95.
 * `name` et `description` sont exclus : le titre du fil peut changer sans refléter la fiche locale.
 */
function autoCheckGamePatchFromScrape(scraped: ScrapedF95Game) {
	return {
		tags: scraped.tags ?? undefined,
		image: scraped.image ?? undefined,
		updatedAt: new Date()
	};
}

/** Cron / bouton dev : met à jour `gameVersion`, `tags`, `image` et le moteur des traductions ; ne modifie pas `game.name`. */
export async function runAutoCheckVersions(): Promise<AutoCheckResult> {
	const issues: AutoCheckIssue[] = [];
	const rows = await db
		.select({
			gameId: table.game.id,
			gameName: table.game.name,
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
		return { scannedGames: 0, updatedGames: 0, updatedTranslations: 0, issues };
	}

	const uniqueByGame = new Map<
		string,
		{ gameId: string; gameName: string; gameVersion: string | null; threadId: number }
	>();
	for (const row of rows) {
		if (row.threadId == null) continue;
		uniqueByGame.set(row.gameId, {
			gameId: row.gameId,
			gameName: row.gameName,
			gameVersion: row.gameVersion,
			threadId: row.threadId
		});
	}

	const versions = await fetchF95Versions(
		Array.from(uniqueByGame.values()).map((g) => g.threadId),
		issues
	);

	type UniqueGameRow = {
		gameId: string;
		gameName: string;
		gameVersion: string | null;
		threadId: number;
	};

	/** Bump si la fiche jeu OU une traduction auto-check a une « version jeu » (ligne) différente du checker. */
	const gameNeedsCheckerBump = (g: UniqueGameRow) => {
		const nextRaw = versions.get(g.threadId);
		if (!nextRaw || nextRaw === 'Unknown') return false;
		const next = nextRaw.trim();
		if ((g.gameVersion ?? '').trim() !== next) return true;
		for (const r of rows) {
			if (r.gameId !== g.gameId || !r.ac) continue;
			const rowV = (r.version ?? '').trim();
			if (rowV !== '' && rowV !== next) return true;
		}
		return false;
	};

	const changedGames = Array.from(uniqueByGame.values()).filter(gameNeedsCheckerBump);

	if (changedGames.length === 0) {
		return { scannedGames: uniqueByGame.size, updatedGames: 0, updatedTranslations: 0, issues };
	}

	const changedGameIds = changedGames.map((g) => g.gameId);
	const impactedTranslations = rows.filter((r) => changedGameIds.includes(r.gameId));
	const staffIds = Array.from(
		new Set(
			impactedTranslations.flatMap((r) =>
				[r.translatorId, r.proofreaderId].filter((v): v is string => typeof v === 'string')
			)
		)
	);
	const staffRows = staffIds.length
		? await db
				.select({ id: table.translator.id, discordId: table.translator.discordId })
				.from(table.translator)
				.where(inArray(table.translator.id, staffIds))
		: [];
	const staffMentionById = new Map(
		staffRows.map(
			(s) => [s.id, s.discordId ? `<@${s.discordId}>` : undefined] as const
		)
	);

	const translatorWebhookLines: TranslatorVersionBumpLine[] = [];
	const proofreaderWebhookLines: TranslatorVersionBumpLine[] = [];

	for (const game of changedGames) {
		const newVersionRaw = versions.get(game.threadId);
		if (!newVersionRaw || newVersionRaw === 'Unknown') continue;
		const newVersion = newVersionRaw.trim();

		await db
			.update(table.game)
			.set({
				gameVersion: newVersion,
				updatedAt: new Date()
			})
			.where(eq(table.game.id, game.gameId));

		await db
			.update(table.gameTranslation)
			.set({ version: newVersion, updatedAt: new Date() })
			.where(
				and(eq(table.gameTranslation.gameId, game.gameId), eq(table.gameTranslation.ac, true))
			);

		try {
			const scraped = await scrapeF95Thread(game.threadId);
			await db
				.update(table.game)
				.set(autoCheckGamePatchFromScrape(scraped))
				.where(eq(table.game.id, game.gameId));
			if (scraped.gameType) {
				const gt = coerceGameEngineType(scraped.gameType);
				await db
					.update(table.gameTranslation)
					.set({ gameType: gt, updatedAt: new Date() })
					.where(eq(table.gameTranslation.gameId, game.gameId));
			}
		} catch (error) {
			console.warn('[auto-check] scrape non bloquant échoué:', error);
			issues.push({
				stage: 'scrape',
				message: 'Scrape F95 non bloquant échoué',
				gameId: game.gameId,
				gameName: game.gameName,
				threadId: game.threadId,
				detail: error instanceof Error ? error.message : String(error)
			});
		}

		for (const t of impactedTranslations.filter((r) => r.gameId === game.gameId)) {
			if (
				!shouldNotifyTranslatorOnAutoCheckVersionBump(
					{
						version: t.version,
						tversion: t.tversion,
						tname: t.tname
					},
					newVersion
				)
			) {
				continue;
			}
			translatorWebhookLines.push({
				gameName: game.gameName,
				translationName: t.translationName,
				oldVersion: game.gameVersion ?? '—',
				newVersion,
				discordMention: t.translatorId ? staffMentionById.get(t.translatorId) : undefined
			});
			if (t.proofreaderId) {
				proofreaderWebhookLines.push({
					gameName: game.gameName,
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
			try {
				await sendDiscordWebhookUpdatesAutoCheckVersionBump({
					gameName: game.gameName,
					translationName: t.translationName,
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

		// Table `update` : seulement si une traduction intégrée avec auto-check actif suit cette version
		const hasIntegratedAc = impactedTranslations.some(
			(t) => t.gameId === game.gameId && t.tname === 'integrated' && t.ac === true
		);
		if (hasIntegratedAc) {
			await touchGameUpdatedToday(game.gameId);
		}
	}

	if (translatorWebhookLines.length > 0) {
		try {
			await sendDiscordWebhookTranslatorsVersionBumps(translatorWebhookLines);
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
			await sendDiscordWebhookProofreadersVersionBumps(proofreaderWebhookLines);
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
		console.warn('[google-sheets-sync] auto-check bulk sync failed:', err);
		issues.push({
			stage: 'google_sheets',
			message: 'Sync Google Sheets bulk échouée',
			detail: err instanceof Error ? err.message : String(err)
		});
	}

	return {
		scannedGames: uniqueByGame.size,
		updatedGames: changedGames.length,
		updatedTranslations: impactedTranslations.length,
		issues
	};
}
