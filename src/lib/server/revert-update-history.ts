import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { clampTranslationAc, getGameAllowsTranslationAutoCheck } from '$lib/server/game-auto-check';
import { coerceGameEngineType } from '$lib/server/game-engine-type';
import { recordTranslationChangeInUpdateHistory } from '$lib/server/game-updates';
import {
	deleteTranslationFromGoogleSheet,
	voidSyncTranslationToGoogleSheet,
	voidSyncTranslatorActivityCountsToGoogleSheet
} from '$lib/server/google-sheets-sync';
import { hasUpdateHistoryTable } from '$lib/server/schema-column-compat';
import { resolveTranslatorAlertsEnabledOnWrite } from '$lib/server/translator-follow-alerts';
import {
	applyHistorySnapshotToTranslationSnapshot,
	parseTranslationUpdateHistoryChanges,
	snapshotFromHistoryDeltas,
	translationRowToHistorySnapshot,
	type TranslationHistorySnapshot,
	type UpdateHistoryAction
} from '$lib/server/update-history';
import { incrementUserGameCounter } from '$lib/server/user-stats-counters';
import { normalizeNullableHistoryString } from '$lib/utils/normalize-nullable-string';
import { and, desc, eq, sql } from 'drizzle-orm';

export class UpdateHistoryRevertError extends Error {
	constructor(
		message: string,
		readonly status: number = 400
	) {
		super(message);
		this.name = 'UpdateHistoryRevertError';
	}
}

type HistoryEntryRow = {
	id: string;
	action: string;
	changesRaw: string | null;
	gameId: string;
};

export type HistoryRevertMeta = {
	revertible: boolean;
	cascadeCount: number;
};

const SUPPORTED_ACTIONS = new Set<UpdateHistoryAction>(['created', 'status_changed', 'deleted']);

async function loadHistoryEntry(gameId: string, historyId: string): Promise<HistoryEntryRow> {
	if (!(await hasUpdateHistoryTable())) {
		throw new UpdateHistoryRevertError('Historique indisponible.', 503);
	}

	const rows = await db
		.select({
			id: table.updateHistory.id,
			action: table.updateHistory.action,
			changesRaw: table.updateHistory.changes,
			gameId: table.update.gameId
		})
		.from(table.updateHistory)
		.innerJoin(table.update, eq(table.updateHistory.updateId, table.update.id))
		.where(and(eq(table.updateHistory.id, historyId), eq(table.update.gameId, gameId)))
		.limit(1);

	if (rows.length === 0) {
		throw new UpdateHistoryRevertError('Entrée d’historique introuvable.', 404);
	}

	return rows[0];
}

async function listTranslationHistoryEntries(
	gameId: string,
	translationId: string
): Promise<HistoryEntryRow[]> {
	return db
		.select({
			id: table.updateHistory.id,
			action: table.updateHistory.action,
			changesRaw: table.updateHistory.changes,
			gameId: table.update.gameId
		})
		.from(table.updateHistory)
		.innerJoin(table.update, eq(table.updateHistory.updateId, table.update.id))
		.where(
			and(
				eq(table.update.gameId, gameId),
				sql`${table.updateHistory.changes}::jsonb->>'translationId' = ${translationId}`
			)
		)
		.orderBy(desc(table.updateHistory.createdAt));
}

async function loadTranslationSnapshot(
	gameId: string,
	translationId: string
): Promise<TranslationHistorySnapshot | null> {
	const rows = await db
		.select()
		.from(table.gameTranslation)
		.where(
			and(eq(table.gameTranslation.id, translationId), eq(table.gameTranslation.gameId, gameId))
		)
		.limit(1);

	if (rows.length === 0) return null;
	return translationRowToHistorySnapshot(rows[0]);
}

function translationPatchFromSnapshot(snapshot: TranslationHistorySnapshot) {
	const tname = snapshot.tname ?? 'translation';
	return {
		translationName: normalizeNullableHistoryString(snapshot.translationName),
		version: normalizeNullableHistoryString(snapshot.version),
		tversion: snapshot.tversion ?? '',
		status: (snapshot.status ?? 'in_progress') as 'in_progress' | 'completed' | 'abandoned',
		ttype: (snapshot.ttype ?? 'manual') as
			| 'auto'
			| 'vf'
			| 'manual'
			| 'semi-auto'
			| 'to_tested'
			| 'hs',
		tlink: snapshot.tlink ?? '',
		tname: tname as (typeof table.gameTranslation.$inferSelect)['tname'],
		gameType: coerceGameEngineType(snapshot.gameType ?? 'other'),
		translatorId: snapshot.translatorId ?? null,
		proofreaderId: snapshot.proofreaderId ?? null,
		ac: snapshot.ac ?? false,
		updatedAt: new Date()
	};
}

function assertSupportedAction(action: string): asserts action is UpdateHistoryAction {
	if (!SUPPORTED_ACTIONS.has(action as UpdateHistoryAction)) {
		throw new UpdateHistoryRevertError('Action d’historique non prise en charge.');
	}
}

async function applyInverseHistoryEntry(
	gameId: string,
	entry: HistoryEntryRow,
	allowsAc: boolean
): Promise<void> {
	const action = entry.action as UpdateHistoryAction;
	assertSupportedAction(action);

	const changes = parseTranslationUpdateHistoryChanges(entry.changesRaw);
	if (!changes) {
		throw new UpdateHistoryRevertError('Données d’historique invalides.');
	}

	const { translationId } = changes;

	if (action === 'created') {
		const existing = await db
			.select({ id: table.gameTranslation.id })
			.from(table.gameTranslation)
			.where(
				and(eq(table.gameTranslation.id, translationId), eq(table.gameTranslation.gameId, gameId))
			)
			.limit(1);

		if (existing.length === 0) {
			throw new UpdateHistoryRevertError('La traduction à supprimer n’existe plus.');
		}

		await db.delete(table.gameTranslation).where(eq(table.gameTranslation.id, translationId));
		return;
	}

	if (action === 'deleted') {
		const existing = await db
			.select({ id: table.gameTranslation.id })
			.from(table.gameTranslation)
			.where(
				and(eq(table.gameTranslation.id, translationId), eq(table.gameTranslation.gameId, gameId))
			)
			.limit(1);

		if (existing.length > 0) {
			throw new UpdateHistoryRevertError('La traduction existe déjà — restauration impossible.');
		}

		const restored = snapshotFromHistoryDeltas(changes.deltas, 'old');
		const insertValues = translationPatchFromSnapshot(restored);
		insertValues.ac = clampTranslationAc(allowsAc, insertValues.ac);

		await db.insert(table.gameTranslation).values({
			id: translationId,
			gameId,
			...insertValues,
			createdAt: new Date()
		});
		return;
	}

	const existing = await db
		.select()
		.from(table.gameTranslation)
		.where(
			and(eq(table.gameTranslation.id, translationId), eq(table.gameTranslation.gameId, gameId))
		)
		.limit(1);

	if (existing.length === 0) {
		throw new UpdateHistoryRevertError('Traduction introuvable.');
	}

	const beforeRow = existing[0];
	const before = translationRowToHistorySnapshot(beforeRow);
	const revertPatch = snapshotFromHistoryDeltas(changes.deltas, 'old');
	const afterSnapshot = applyHistorySnapshotToTranslationSnapshot(before, revertPatch);
	const patch = translationPatchFromSnapshot(afterSnapshot);
	patch.ac = clampTranslationAc(allowsAc, patch.ac);

	await db
		.update(table.gameTranslation)
		.set({
			...patch,
			translatorAlertsEnabled: resolveTranslatorAlertsEnabledOnWrite({
				beforeTranslatorId: beforeRow.translatorId,
				afterTranslatorId: patch.translatorId,
				currentTranslatorAlertsEnabled: beforeRow.translatorAlertsEnabled
			})
		})
		.where(eq(table.gameTranslation.id, translationId));
}

export async function revertUpdateHistoryEntry(
	gameId: string,
	historyId: string,
	userId: string
): Promise<{ translationId: string; action: UpdateHistoryAction; cascadeCount: number }> {
	const targetEntry = await loadHistoryEntry(gameId, historyId);
	const targetChanges = parseTranslationUpdateHistoryChanges(targetEntry.changesRaw);
	if (!targetChanges) {
		throw new UpdateHistoryRevertError('Données d’historique invalides.');
	}

	assertSupportedAction(targetEntry.action);

	const allEntries = await listTranslationHistoryEntries(gameId, targetChanges.translationId);
	const targetIndex = allEntries.findIndex((entry) => entry.id === historyId);
	if (targetIndex === -1) {
		throw new UpdateHistoryRevertError('Entrée d’historique introuvable pour cette traduction.');
	}

	const entriesToUndo = allEntries.slice(0, targetIndex + 1);
	const { translationId } = targetChanges;
	const allowsAc = await getGameAllowsTranslationAutoCheck(gameId);
	const beforeSnapshot = await loadTranslationSnapshot(gameId, translationId);

	for (const entry of entriesToUndo) {
		await applyInverseHistoryEntry(gameId, entry, allowsAc);
	}

	const afterSnapshot = await loadTranslationSnapshot(gameId, translationId);

	await recordTranslationChangeInUpdateHistory(gameId, {
		userId,
		translationId,
		before: beforeSnapshot,
		after: afterSnapshot,
		updateKind: 'update'
	});

	if (afterSnapshot === null) {
		void deleteTranslationFromGoogleSheet(translationId).catch((err) => {
			console.warn('[google-sheets-sync] revert delete translation failed:', err);
		});
	} else {
		voidSyncTranslationToGoogleSheet(translationId, 'history/revert-translation');
	}
	voidSyncTranslatorActivityCountsToGoogleSheet(
		beforeSnapshot?.translatorId,
		beforeSnapshot?.proofreaderId,
		afterSnapshot?.translatorId,
		afterSnapshot?.proofreaderId
	);

	await incrementUserGameCounter(userId, 'edit', 1);

	return {
		translationId,
		action: targetEntry.action as UpdateHistoryAction,
		cascadeCount: entriesToUndo.length
	};
}

export async function enrichHistoryRevertMeta(
	gameId: string,
	entries: {
		id: string;
		action: UpdateHistoryAction;
		changes: ReturnType<typeof parseTranslationUpdateHistoryChanges>;
	}[]
): Promise<Map<string, HistoryRevertMeta>> {
	const meta = new Map<string, HistoryRevertMeta>();
	if (entries.length === 0 || !(await hasUpdateHistoryTable())) {
		return meta;
	}

	const rows = await db
		.select({
			id: table.updateHistory.id,
			changesRaw: table.updateHistory.changes
		})
		.from(table.updateHistory)
		.innerJoin(table.update, eq(table.updateHistory.updateId, table.update.id))
		.where(eq(table.update.gameId, gameId))
		.orderBy(desc(table.updateHistory.createdAt));

	const orderedIdsByTranslation = new Map<string, string[]>();
	for (const row of rows) {
		const changes = parseTranslationUpdateHistoryChanges(row.changesRaw);
		if (!changes) continue;
		const list = orderedIdsByTranslation.get(changes.translationId) ?? [];
		list.push(row.id);
		orderedIdsByTranslation.set(changes.translationId, list);
	}

	for (const entry of entries) {
		if (!entry.changes || !SUPPORTED_ACTIONS.has(entry.action)) {
			meta.set(entry.id, { revertible: false, cascadeCount: 0 });
			continue;
		}

		const orderedIds = orderedIdsByTranslation.get(entry.changes.translationId) ?? [];
		const index = orderedIds.indexOf(entry.id);
		if (index === -1) {
			meta.set(entry.id, { revertible: false, cascadeCount: 0 });
			continue;
		}

		meta.set(entry.id, { revertible: true, cascadeCount: index + 1 });
	}

	return meta;
}
