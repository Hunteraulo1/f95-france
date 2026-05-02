import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	sendDiscordWebhookTranslatorsVersionBumps,
	sendDiscordWebhookUpdatesAutoCheckVersionBump
} from '$lib/server/discord-webhook';
import { syncDbToSpreadsheetBulk } from '$lib/server/google-sheets-sync';
import { touchGameUpdatedToday } from '$lib/server/game-updates';
import { scrapeF95Thread } from '$lib/server/scrape/f95';
import { coerceGameEngineType } from '$lib/server/game-engine-type';
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

export async function runAutoCheckVersions(): Promise<AutoCheckResult> {
	const rows = await db
		.select({
			gameId: table.game.id,
			gameName: table.game.name,
			gameVersion: table.game.gameVersion,
			threadId: table.game.threadId,
			translationId: table.gameTranslation.id,
			translationName: table.gameTranslation.translationName,
			tname: table.gameTranslation.tname,
			ac: table.gameTranslation.ac,
			translatorId: table.gameTranslation.translatorId
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

	const uniqueByGame = new Map<string, { gameId: string; gameName: string; gameVersion: string | null; threadId: number }>();
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
	const changedGames = Array.from(uniqueByGame.values()).filter((g) => {
		const next = versions.get(g.threadId);
		if (!next || next === 'Unknown') return false;
		return (g.gameVersion ?? '') !== next;
	});

	if (changedGames.length === 0) {
		return { scannedGames: uniqueByGame.size, updatedGames: 0, updatedTranslations: 0 };
	}

	const changedGameIds = changedGames.map((g) => g.gameId);
	const impactedTranslations = rows.filter((r) => changedGameIds.includes(r.gameId));
	const translatorIds = Array.from(
		new Set(
			impactedTranslations.map((r) => r.translatorId).filter((v): v is string => typeof v === 'string')
		)
	);
	const translators = translatorIds.length
		? await db
				.select({ id: table.translator.id, discordId: table.translator.discordId })
				.from(table.translator)
				.where(inArray(table.translator.id, translatorIds))
		: [];
	const translatorMentionById = new Map(
		translators.map((t) => [t.id, t.discordId?.trim() ? `<@${t.discordId.trim()}>` : undefined] as const)
	);

	for (const game of changedGames) {
		const newVersion = versions.get(game.threadId);
		if (!newVersion || newVersion === 'Unknown') continue;

		await db
			.update(table.game)
			.set({
				gameVersion: newVersion,
				updatedAt: new Date()
			})
			.where(eq(table.game.id, game.gameId));

		try {
			const scraped = await scrapeF95Thread(game.threadId);
			await db
				.update(table.game)
				.set({
					tags: scraped.tags ?? undefined,
					image: scraped.image ?? undefined,
					updatedAt: new Date()
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
			console.warn('[auto-check] scrape non bloquant échoué:', error);
		}

		const lines = impactedTranslations
			.filter((t) => t.gameId === game.gameId)
			.map((t) => {
				const trLabel = t.translationName?.trim() ? ` - ${t.translationName.trim()}` : '';
				return {
					label: `${game.gameName}${trLabel} (${game.gameVersion ?? '—'} -> ${newVersion})`,
					discordMention: t.translatorId ? translatorMentionById.get(t.translatorId) : undefined
				};
			});

		if (lines.length > 0) {
			await sendDiscordWebhookTranslatorsVersionBumps(lines);
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
