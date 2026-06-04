import { appLogWarn } from '$lib/server/app-log-bridge';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { hasUpdateHistoryTable } from '$lib/server/schema-column-compat';
import type {
    TranslationHistorySnapshot,
    TranslationUpdateHistoryChanges,
    UpdateHistoryContext,
    UpdateHistoryFieldDelta
} from '$lib/updates/update-history-types';
import { normalizeNullableHistoryString } from '$lib/utils/normalize-nullable-string';

export type {
    TranslationHistorySnapshot,
    TranslationUpdateHistoryChanges,
    UpdateHistoryAction,
    UpdateHistoryContext,
    UpdateHistoryFieldDelta
} from '$lib/updates/update-history-types';
export { normalizeNullableHistoryString } from '$lib/utils/normalize-nullable-string';

const TRACKED_TRANSLATION_FIELDS = [
	'translationName',
	'version',
	'tversion',
	'status',
	'ttype',
	'tlink',
	'tname',
	'gameType',
	'translatorId',
	'proofreaderId',
	'ac'
] as const satisfies readonly (keyof TranslationHistorySnapshot)[];

export function translationRowToHistorySnapshot(
	row: TranslationHistorySnapshot
): TranslationHistorySnapshot {
	return {
		translationName: normalizeNullableHistoryString(row.translationName),
		version: normalizeNullableHistoryString(row.version),
		tversion: row.tversion,
		status: row.status,
		ttype: row.ttype,
		tlink: row.tlink ?? '',
		tname: row.tname,
		gameType: row.gameType,
		translatorId: row.translatorId ?? null,
		proofreaderId: row.proofreaderId ?? null,
		ac: row.ac ?? false
	};
}

export function buildTranslationHistoryContext(
	translationId: string,
	before: TranslationHistorySnapshot | null,
	after: TranslationHistorySnapshot | null
): UpdateHistoryContext | null {
	if (!before && after) {
		const deltas = TRACKED_TRANSLATION_FIELDS.filter((field) => after[field] !== undefined).map(
			(field) => ({
				field,
				oldValue: null,
				newValue: after[field] ?? null
			})
		);
		if (deltas.length === 0) return null;
		return {
			action: 'created',
			changes: { entity: 'translation', translationId, deltas }
		};
	}

	if (before && !after) {
		return {
			action: 'deleted',
			changes: {
				entity: 'translation',
				translationId,
				deltas: TRACKED_TRANSLATION_FIELDS.map((field) => ({
					field,
					oldValue: before[field] ?? null,
					newValue: null
				}))
			}
		};
	}

	if (before && after) {
		const deltas = TRACKED_TRANSLATION_FIELDS.filter((field) => before[field] !== after[field]).map(
			(field) => ({
				field,
				oldValue: before[field] ?? null,
				newValue: after[field] ?? null
			})
		);
		if (deltas.length === 0) return null;
		return {
			action: 'status_changed',
			changes: { entity: 'translation', translationId, deltas }
		};
	}

	return null;
}

export function parseTranslationUpdateHistoryChanges(
	raw: string | null
): TranslationUpdateHistoryChanges | null {
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

export function snapshotFromHistoryDeltas(
	deltas: UpdateHistoryFieldDelta[],
	source: 'old' | 'new'
): TranslationHistorySnapshot {
	const snap: TranslationHistorySnapshot = {};
	for (const delta of deltas) {
		const value = source === 'old' ? delta.oldValue : delta.newValue;
		switch (delta.field) {
			case 'translationName':
				snap.translationName = normalizeNullableHistoryString(value);
				break;
			case 'version':
				snap.version = normalizeNullableHistoryString(value);
				break;
			case 'tversion':
				if (value != null) snap.tversion = String(value);
				break;
			case 'status':
				if (value != null) snap.status = String(value);
				break;
			case 'ttype':
				if (value != null) snap.ttype = String(value);
				break;
			case 'tlink':
				if (value != null) snap.tlink = String(value);
				break;
			case 'tname':
				if (value != null) snap.tname = String(value);
				break;
			case 'gameType':
				if (value != null) snap.gameType = String(value);
				break;
			case 'translatorId':
				snap.translatorId = value == null || value === '' ? null : String(value);
				break;
			case 'proofreaderId':
				snap.proofreaderId = value == null || value === '' ? null : String(value);
				break;
			case 'ac':
				snap.ac = Boolean(value);
				break;
		}
	}
	return snap;
}

export function applyHistorySnapshotToTranslationSnapshot(
	base: TranslationHistorySnapshot,
	patch: TranslationHistorySnapshot
): TranslationHistorySnapshot {
	return translationRowToHistorySnapshot({ ...base, ...patch });
}

export async function recordUpdateHistoryEntry(
	updateId: string,
	context: UpdateHistoryContext
): Promise<void> {
	if (!(await hasUpdateHistoryTable())) return;

	try {
		await db.insert(table.updateHistory).values({
			updateId,
			userId: context.userId ?? null,
			action: context.action,
			changes: JSON.stringify(context.changes)
		});
	} catch (error) {
		appLogWarn('system', 'update-history record skipped', error);
	}
}
