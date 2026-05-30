import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { hasUpdateHistoryTable } from '$lib/server/schema-column-compat';

export type UpdateHistoryAction = 'created' | 'status_changed' | 'deleted';

export type TranslationHistorySnapshot = {
	translationName?: string | null;
	version?: string | null;
	tversion?: string;
	status?: string;
	ttype?: string;
	tlink?: string;
	tname?: string;
	gameType?: string;
	translatorId?: string | null;
	proofreaderId?: string | null;
	ac?: boolean;
};

export type UpdateHistoryFieldDelta = {
	field: string;
	oldValue: unknown;
	newValue: unknown;
};

export type TranslationUpdateHistoryChanges = {
	entity: 'translation';
	translationId: string;
	deltas: UpdateHistoryFieldDelta[];
};

export type UpdateHistoryContext = {
	userId?: string | null;
	action: UpdateHistoryAction;
	changes: TranslationUpdateHistoryChanges;
};

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
		translationName: row.translationName ?? null,
		version: row.version ?? null,
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
		console.warn('[update-history] record skipped:', error);
	}
}
