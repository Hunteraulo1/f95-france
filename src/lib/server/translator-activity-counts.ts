import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { count, eq, sql, type SQL } from 'drizzle-orm';

export type TranslatorActivityCounts = {
	tradCount: number;
	readCount: number;
};

const emptyCounts = (): TranslatorActivityCounts => ({ tradCount: 0, readCount: 0 });

/** Nombre de traductions où le traducteur est `translator_id`. */
export function translatorTradCountExpr(): SQL<number> {
	return sql<number>`coalesce((
		select count(*)
		from ${table.gameTranslation}
		where ${table.gameTranslation.translatorId} = ${table.translator.id}
	), 0)`;
}

/** Nombre de traductions où le traducteur est `proofreader_id`. */
export function translatorReadCountExpr(): SQL<number> {
	return sql<number>`coalesce((
		select count(*)
		from ${table.gameTranslation}
		where ${table.gameTranslation.proofreaderId} = ${table.translator.id}
	), 0)`;
}

/** Compteurs agrégés depuis `game_translation` (une passe en mémoire). */
export async function loadTranslatorActivityCountsById(): Promise<
	Map<string, TranslatorActivityCounts>
> {
	const rows = await db
		.select({
			translatorId: table.gameTranslation.translatorId,
			proofreaderId: table.gameTranslation.proofreaderId
		})
		.from(table.gameTranslation);

	const map = new Map<string, TranslatorActivityCounts>();
	const ensure = (id: string): TranslatorActivityCounts => {
		let entry = map.get(id);
		if (!entry) {
			entry = emptyCounts();
			map.set(id, entry);
		}
		return entry;
	};

	for (const row of rows) {
		if (row.translatorId) ensure(row.translatorId).tradCount += 1;
		if (row.proofreaderId) ensure(row.proofreaderId).readCount += 1;
	}

	return map;
}

export function getTranslatorActivityCounts(
	map: Map<string, TranslatorActivityCounts>,
	translatorId: string
): TranslatorActivityCounts {
	return map.get(translatorId) ?? emptyCounts();
}

/** Compteurs pour un seul traducteur (sync unitaire). */
export async function getTranslatorActivityCountsForId(
	translatorId: string
): Promise<TranslatorActivityCounts> {
	const [tradRow] = await db
		.select({ count: count() })
		.from(table.gameTranslation)
		.where(eq(table.gameTranslation.translatorId, translatorId));
	const [readRow] = await db
		.select({ count: count() })
		.from(table.gameTranslation)
		.where(eq(table.gameTranslation.proofreaderId, translatorId));
	return {
		tradCount: Number(tradRow?.count ?? 0),
		readCount: Number(readRow?.count ?? 0)
	};
}
