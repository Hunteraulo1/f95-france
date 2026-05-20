import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { syncMajToGoogleSheet } from '$lib/server/google-sheets-sync';
import { hasUpdateStatusColumn } from '$lib/server/schema-column-compat';
import { eq, sql } from 'drizzle-orm';

/**
 * Alimente la table `update` pour un jeu donné.
 * - si une ligne existe déjà pour `gameId`, on met à jour `updatedAt`
 * - sinon on crée la ligne
 */
export async function createGameUpdateRow(
	gameId: string,
	status: 'adding' | 'update'
): Promise<void> {
	if (await hasUpdateStatusColumn()) {
		await db.insert(table.update).values({
			gameId,
			status,
			createdAt: new Date(),
			updatedAt: new Date()
		});
	} else {
		// Compat temporaire avant migration `update.status`
		await db.insert(table.update).values({
			gameId,
			createdAt: new Date(),
			updatedAt: new Date()
		});
	}
	void syncMajToGoogleSheet().catch((err) => {
		console.warn('[google-sheets-sync] MAJ sync failed:', err);
	});
}

/**
 * Pour les modifications de jeu:
 * - crée une ligne `update` s'il n'y en a pas encore aujourd'hui pour ce jeu
 * - sinon met simplement à jour `updatedAt` de la ligne du jour
 */
export async function touchGameUpdatedToday(gameId: string): Promise<void> {
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
			void syncMajToGoogleSheet().catch((err) => {
				console.warn('[google-sheets-sync] MAJ sync failed:', err);
			});
			return;
		}

		await createGameUpdateRow(gameId, 'update');
	} catch (error) {
		console.warn('[game-updates] touchGameUpdatedToday skipped:', error);
	}
}

export async function deleteGameUpdate(gameId: string): Promise<void> {
	await db.delete(table.update).where(eq(table.update.gameId, gameId));
	void syncMajToGoogleSheet().catch((err) => {
		console.warn('[google-sheets-sync] MAJ sync failed:', err);
	});
}
