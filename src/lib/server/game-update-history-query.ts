import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { enrichHistoryRevertMeta } from '$lib/server/revert-update-history';
import { hasUpdateHistoryTable } from '$lib/server/schema-column-compat';
import {
	parseTranslationUpdateHistoryChanges,
	type TranslationUpdateHistoryChanges,
	type UpdateHistoryAction
} from '$lib/server/update-history';
import {
	GAME_UPDATE_HISTORY_PAGE_SIZE,
	type GameUpdateHistoryEntry,
	type GameUpdateHistoryPage
} from '$lib/updates/update-history-types';
import { desc, eq, sql } from 'drizzle-orm';

export {
	GAME_UPDATE_HISTORY_PAGE_SIZE,
	type GameUpdateHistoryEntry,
	type GameUpdateHistoryPage
} from '$lib/updates/update-history-types';

function parseHistoryChanges(raw: string | null): TranslationUpdateHistoryChanges | null {
	return parseTranslationUpdateHistoryChanges(raw);
}

async function countGameUpdateHistory(gameId: string): Promise<number> {
	const rows = await db
		.select({ count: sql<number>`count(*)`.as('count') })
		.from(table.updateHistory)
		.innerJoin(table.update, eq(table.updateHistory.updateId, table.update.id))
		.where(eq(table.update.gameId, gameId));
	return Number(rows[0]?.count ?? 0);
}

async function mapHistoryRows(
	gameId: string,
	rows: {
		id: string;
		action: string;
		createdAt: Date;
		userId: string | null;
		username: string | null;
		updateId: string;
		updateStatus: string;
		changes: string | null;
	}[]
): Promise<GameUpdateHistoryEntry[]> {
	const entries = rows.map((row) => ({
		id: row.id,
		action: row.action as UpdateHistoryAction,
		createdAt: row.createdAt,
		userId: row.userId,
		username: row.username,
		updateId: row.updateId,
		updateStatus: row.updateStatus,
		changes: parseHistoryChanges(row.changes),
		revertible: false,
		revertCascadeCount: 0
	}));

	const revertMeta = await enrichHistoryRevertMeta(
		gameId,
		entries.map((entry) => ({
			id: entry.id,
			action: entry.action,
			changes: entry.changes
		}))
	);

	return entries.map((entry) => {
		const meta = revertMeta.get(entry.id);
		return {
			...entry,
			revertible: meta?.revertible ?? false,
			revertCascadeCount: meta?.cascadeCount ?? 0
		};
	});
}

export async function listGameUpdateHistoryPage(
	gameId: string,
	requestedPage = 1,
	pageSize = GAME_UPDATE_HISTORY_PAGE_SIZE
): Promise<GameUpdateHistoryPage> {
	const empty: GameUpdateHistoryPage = {
		entries: [],
		totalCount: 0,
		page: 1,
		totalPages: 1,
		pageSize
	};

	if (!(await hasUpdateHistoryTable())) return empty;

	const totalCount = await countGameUpdateHistory(gameId);
	if (totalCount === 0) return empty;

	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
	const page = Math.min(Math.max(1, requestedPage), totalPages);
	const offset = (page - 1) * pageSize;

	const rows = await db
		.select({
			id: table.updateHistory.id,
			action: table.updateHistory.action,
			createdAt: table.updateHistory.createdAt,
			userId: table.updateHistory.userId,
			username: table.user.username,
			updateId: table.updateHistory.updateId,
			updateStatus: table.update.status,
			changes: table.updateHistory.changes
		})
		.from(table.updateHistory)
		.innerJoin(table.update, eq(table.updateHistory.updateId, table.update.id))
		.leftJoin(table.user, eq(table.user.id, table.updateHistory.userId))
		.where(eq(table.update.gameId, gameId))
		.orderBy(desc(table.updateHistory.createdAt))
		.limit(pageSize)
		.offset(offset);

	return {
		entries: await mapHistoryRows(gameId, rows),
		totalCount,
		page,
		totalPages,
		pageSize
	};
}

/** @deprecated Préférer {@link listGameUpdateHistoryPage} */
export async function listGameUpdateHistory(
	gameId: string,
	limit = 40
): Promise<GameUpdateHistoryEntry[]> {
	const page = await listGameUpdateHistoryPage(gameId, 1, limit);
	return page.entries;
}
