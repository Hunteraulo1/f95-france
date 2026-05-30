import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { hasUpdateHistoryTable } from '$lib/server/schema-column-compat';
import {
	type TranslationUpdateHistoryChanges,
	type UpdateHistoryAction
} from '$lib/server/update-history';
import { desc, eq } from 'drizzle-orm';

export type GameUpdateHistoryEntry = {
	id: string;
	action: UpdateHistoryAction;
	createdAt: Date;
	userId: string | null;
	username: string | null;
	updateId: string;
	updateStatus: string;
	changes: TranslationUpdateHistoryChanges | null;
};

function parseHistoryChanges(raw: string | null): TranslationUpdateHistoryChanges | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (
			typeof parsed === 'object' &&
			parsed !== null &&
			(parsed as TranslationUpdateHistoryChanges).entity === 'translation' &&
			typeof (parsed as TranslationUpdateHistoryChanges).translationId === 'string' &&
			Array.isArray((parsed as TranslationUpdateHistoryChanges).deltas)
		) {
			return parsed as TranslationUpdateHistoryChanges;
		}
	} catch {
		return null;
	}
	return null;
}

export async function listGameUpdateHistory(
	gameId: string,
	limit = 40
): Promise<GameUpdateHistoryEntry[]> {
	if (!(await hasUpdateHistoryTable())) return [];

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
		.limit(limit);

	return rows.map((row) => ({
		id: row.id,
		action: row.action as UpdateHistoryAction,
		createdAt: row.createdAt,
		userId: row.userId,
		username: row.username,
		updateId: row.updateId,
		updateStatus: row.updateStatus,
		changes: parseHistoryChanges(row.changes)
	}));
}
