import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	sendDiscordWebhookProofreadersVersionBumps,
	sendDiscordWebhookTranslatorsVersionBumps,
	sendDiscordWebhookUpdatesAutoCheckVersionBump,
	type TranslatorVersionBumpLine
} from '$lib/server/discord-webhook';
import { syncDbToSpreadsheetBulk } from '$lib/server/google-sheets-sync';
import { touchGameUpdatedToday } from '$lib/server/game-updates';
import { scrapeF95Thread, type ScrapedF95Game } from '$lib/server/scrape/f95';
import { coerceGameEngineType } from '$lib/server/game-engine-type';
import { shouldNotifyTranslatorOnAutoCheckVersionBump } from '$lib/server/translation-notify-rules';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';

type CheckerResponse = {
	status: 'ok' | 'error' | string;
	msg: Record<string, string> | string;
};

const CHECKER_URL = 'https://f95zone.to/sam/checker.php?threads=';
const USER_AGENT =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) f95-france/1.0';

async function fetchF95Versions(threadIds: number[]): Promise<Map<number, string>> {
	const versions = new Map<number, string>();
	if (threadIds.length === 0) return versions;

	for (let i = 0; i < threadIds.length; i += 100) {
		const batch = threadIds.slice(i, i + 100);
		const url = `${CHECKER_URL}${batch.join(',')}`;
		const res = await fetch(url, {
			headers: { 'User-Agent': USER_AGENT }
		});
		if (!res.ok) continue;

		const json = (await res.json()) as CheckerResponse;
		if (json.status !== 'ok' || typeof json.msg !== 'object' || json.msg === null) continue;

		for (const [threadIdRaw, version] of Object.entries(json.msg)) {
			const threadId = Number.parseInt(threadIdRaw, 10);
			if (!Number.isFinite(threadId) || typeof version !== 'string') continue;
			versions.set(threadId, version);
		}
	}

	return versions;
}

type AutoCheckResult = {
	scannedGames: number;
	updatedGames: number;
	updatedTranslations: number;
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
		return { scannedGames: 0, updatedGames: 0, updatedTranslations: 0 };
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

	const versions = await fetchF95Versions(Array.from(uniqueByGame.values()).map((g) => g.threadId));

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
		return { scannedGames: uniqueByGame.size, updatedGames: 0, updatedTranslations: 0 };
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
			(s) => [s.id, s.discordId?.trim() ? `<@${s.discordId.trim()}>` : undefined] as const
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
			await sendDiscordWebhookUpdatesAutoCheckVersionBump({
				gameName: game.gameName,
				translationName: t.translationName,
				oldVersion: game.gameVersion,
				newVersion
			});
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
		await sendDiscordWebhookTranslatorsVersionBumps(translatorWebhookLines);
	}
	if (proofreaderWebhookLines.length > 0) {
		await sendDiscordWebhookProofreadersVersionBumps(proofreaderWebhookLines);
	}

	// Une seule synchro bulk évite les lectures répétées (et les 429 quota/minute).
	void syncDbToSpreadsheetBulk().catch((err) => {
		console.warn('[google-sheets-sync] auto-check bulk sync failed:', err);
	});

	return {
		scannedGames: uniqueByGame.size,
		updatedGames: changedGames.length,
		updatedTranslations: impactedTranslations.length
	};
}
