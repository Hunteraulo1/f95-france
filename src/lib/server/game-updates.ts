import { appLogWarn } from '$lib/server/app-log-bridge';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { randomUUID } from 'node:crypto';
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
	history?: UpdateHistoryContext,
	translationId?: string | null
): Promise<string | null> {
	const updateId = randomUUID();
	// Trad ciblée : override explicite, sinon celle portée par l'historique.
	// Si la trad vient d'être supprimée, son id n'existe plus dans `game_translation` : ne pas la lier (FK).
	const linkedTranslationId =
		translationId ??
		(history?.action !== 'deleted' ? history?.changes.translationId : null) ??
		null;

	if (await hasUpdateStatusColumn()) {
		await db.insert(table.update).values({
			id: updateId,
			gameId,
			translationId: linkedTranslationId,
			status,
			createdAt: new Date(),
			updatedAt: new Date()
		});
	} else {
		// Compat temporaire avant migration `update.status`
		await db.insert(table.update).values({
			id: updateId,
			gameId,
			translationId: linkedTranslationId,
			createdAt: new Date(),
			updatedAt: new Date()
		});
	}

	if (updateId && history) {
		await recordUpdateHistoryEntry(updateId, history);
	}

	void syncMajToGoogleSheet().catch((err) => {
		appLogWarn('sheets-sync', 'MAJ sync failed', err);
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
			// La ligne du jour est partagée par jeu : on la pointe vers la trad
			// la plus récemment modifiée (déterministe, vs. ancien fallback timing).
			// Si la trad vient d'être supprimée, son id n'existe plus dans `game_translation` : ne pas la lier (FK).
			const linkedTranslationId =
				history?.action !== 'deleted' ? (history?.changes.translationId ?? null) : null;
			await db
				.update(table.update)
				.set({
					updatedAt: new Date(),
					...(linkedTranslationId ? { translationId: linkedTranslationId } : {})
				})
				.where(eq(table.update.id, todayUpdateRow[0].id));
			if (history) {
				await recordUpdateHistoryEntry(todayUpdateRow[0].id, history);
			}
			void syncMajToGoogleSheet().catch((err) => {
				appLogWarn('sheets-sync', 'MAJ sync failed', err);
			});
			return;
		}

		await createGameUpdateRow(gameId, 'update', history);
	} catch (error) {
		appLogWarn('system', 'touchGameUpdatedToday skipped', error);
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
		appLogWarn('sheets-sync', 'MAJ sync failed', err);
	});
}
