import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	syncMajToGoogleSheet,
	voidSyncGameTranslationsToGoogleSheet
} from '$lib/server/google-sheets-sync';
import { hasUpdateStatusColumn } from '$lib/server/schema-column-compat';
import {
	buildTranslationHistoryContext,
	recordUpdateHistoryEntry,
	type TranslationHistorySnapshot,
	type UpdateHistoryContext
} from '$lib/server/update-history';
import { eq, sql } from 'drizzle-orm';

/**
 * Alimente la table `update` pour un jeu donné.
 * - si une ligne existe déjà pour `gameId`, on met à jour `updatedAt`
 * - sinon on crée la ligne
 */
export async function createGameUpdateRow(
	gameId: string,
	status: 'adding' | 'update',
	history?: UpdateHistoryContext
): Promise<string | null> {
	let updateId: string | null;

	if (await hasUpdateStatusColumn()) {
		const [row] = await db
			.insert(table.update)
			.values({
				gameId,
				status,
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning({ id: table.update.id });
		updateId = row?.id ?? null;
	} else {
		// Compat temporaire avant migration `update.status`
		const [row] = await db
			.insert(table.update)
			.values({
				gameId,
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.returning({ id: table.update.id });
		updateId = row?.id ?? null;
	}

	if (updateId && history) {
		await recordUpdateHistoryEntry(updateId, history);
	}

	void syncMajToGoogleSheet().catch((err) => {
		console.warn('[google-sheets-sync] MAJ sync failed:', err);
	});

	if (status === 'adding') {
		voidSyncGameTranslationsToGoogleSheet(gameId, 'update/adding');
	}

	return updateId;
}

/**
 * Pour les modifications de jeu:
 * - crée une ligne `update` s'il n'y en a pas encore aujourd'hui pour ce jeu
 * - sinon met simplement à jour `updatedAt` de la ligne du jour
 */
export async function touchGameUpdatedToday(
	gameId: string,
	history?: UpdateHistoryContext
): Promise<void> {
	try {
		const hasStatus = await hasUpdateStatusColumn();
		const todayUpdateRow = await db
			.select({ id: table.update.id })
			.from(table.update)
			.where(
				hasStatus
					? sql`${table.update.gameId} = ${gameId} AND ${table.update.status} = 'update' AND DATE(${table.update.createdAt}) = CURRENT_DATE`
					: sql`${table.update.gameId} = ${gameId} AND DATE(${table.update.createdAt}) = CURRENT_DATE`
			)
			.limit(1);

		if (todayUpdateRow[0]?.id) {
			await db
				.update(table.update)
				.set({ updatedAt: new Date() })
				.where(eq(table.update.id, todayUpdateRow[0].id));
			if (history) {
				await recordUpdateHistoryEntry(todayUpdateRow[0].id, history);
			}
			void syncMajToGoogleSheet().catch((err) => {
				console.warn('[google-sheets-sync] MAJ sync failed:', err);
			});
			return;
		}

		await createGameUpdateRow(gameId, 'update', history);
	} catch (error) {
		console.warn('[game-updates] touchGameUpdatedToday skipped:', error);
	}
}

export async function recordTranslationChangeInUpdateHistory(
	gameId: string,
	options: {
		userId?: string | null;
		translationId: string;
		before: TranslationHistorySnapshot | null;
		after: TranslationHistorySnapshot | null;
		updateKind: 'adding' | 'update';
	}
): Promise<void> {
	const history = buildTranslationHistoryContext(
		options.translationId,
		options.before,
		options.after
	);
	if (!history) return;

	const context: UpdateHistoryContext = {
		userId: options.userId ?? null,
		...history
	};

	if (options.updateKind === 'adding') {
		await createGameUpdateRow(gameId, 'adding', context);
		return;
	}

	await touchGameUpdatedToday(gameId, context);
}

export async function deleteGameUpdate(gameId: string): Promise<void> {
	await db.delete(table.update).where(eq(table.update.gameId, gameId));
	void syncMajToGoogleSheet().catch((err) => {
		console.warn('[google-sheets-sync] MAJ sync failed:', err);
	});
}
