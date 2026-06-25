import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

const RUN_PAGE_SIZE = 30;

export type AutoCheckRunListRow = {
	id: string;
	triggerSource: string;
	status: string;
	scannedGames: number;
	updatedGames: number;
	updatedTranslations: number;
	alignedGames: number;
	translatorWebhooksSent: number;
	proofreaderWebhooksSent: number;
	issueCount: number;
	durationMs: number | null;
	fatalError: string | null;
	startedAt: Date;
	finishedAt: Date | null;
};

export type AutoCheckRunItemRow = {
	id: string;
	kind: string;
	gameId: string | null;
	gameName: string | null;
	translationId: string | null;
	translationName: string | null;
	threadId: number | null;
	oldVersion: string | null;
	newVersion: string | null;
	stage: string | null;
	message: string | null;
	detail: string | null;
};

export async function loadAutoCheckRunsPage(selectedRunId?: string | null) {
	const runs = await db
		.select({
			id: table.autoCheckRun.id,
			triggerSource: table.autoCheckRun.triggerSource,
			status: table.autoCheckRun.status,
			scannedGames: table.autoCheckRun.scannedGames,
			updatedGames: table.autoCheckRun.updatedGames,
			updatedTranslations: table.autoCheckRun.updatedTranslations,
			alignedGames: table.autoCheckRun.alignedGames,
			translatorWebhooksSent: table.autoCheckRun.translatorWebhooksSent,
			proofreaderWebhooksSent: table.autoCheckRun.proofreaderWebhooksSent,
			issueCount: table.autoCheckRun.issueCount,
			durationMs: table.autoCheckRun.durationMs,
			fatalError: table.autoCheckRun.fatalError,
			startedAt: table.autoCheckRun.startedAt,
			finishedAt: table.autoCheckRun.finishedAt
		})
		.from(table.autoCheckRun)
		.orderBy(desc(table.autoCheckRun.startedAt))
		.limit(RUN_PAGE_SIZE);

	const selectedId =
		selectedRunId && runs.some((r) => r.id === selectedRunId) ? selectedRunId : runs[0]?.id;

	let items: AutoCheckRunItemRow[] = [];
	if (selectedId) {
		items = await db
			.select({
				id: table.autoCheckRunItem.id,
				kind: table.autoCheckRunItem.kind,
				gameId: table.autoCheckRunItem.gameId,
				gameName: table.autoCheckRunItem.gameName,
				translationId: table.autoCheckRunItem.translationId,
				translationName: table.autoCheckRunItem.translationName,
				threadId: table.autoCheckRunItem.threadId,
				oldVersion: table.autoCheckRunItem.oldVersion,
				newVersion: table.autoCheckRunItem.newVersion,
				stage: table.autoCheckRunItem.stage,
				message: table.autoCheckRunItem.message,
				detail: table.autoCheckRunItem.detail
			})
			.from(table.autoCheckRunItem)
			.where(eq(table.autoCheckRunItem.runId, selectedId));
	}

	return {
		runs,
		selectedRunId: selectedId ?? null,
		items
	};
}
