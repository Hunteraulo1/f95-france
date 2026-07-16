import { appLogWarn } from '$lib/server/app-log-bridge';
import type { AutoCheckResult } from '$lib/server/check-version';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { notifyAutoCheckIssues } from '$lib/server/notifications';
import { eq } from 'drizzle-orm';

export type AutoCheckTriggerSource = 'cron' | 'manual' | 'worker';

export type AutoCheckGameUpdateRecord = {
	gameId: string;
	gameName: string;
	threadId: number;
	oldVersion: string | null;
	newVersion: string;
	updatedTranslations: number;
};

function resolveRunStatus(result: AutoCheckResult): 'success' | 'success_with_issues' {
	return result.issues.length > 0 ? 'success_with_issues' : 'success';
}

export class AutoCheckRunRecorder {
	readonly runId: string;
	private readonly triggerSource: AutoCheckTriggerSource;
	private readonly gameUpdates: AutoCheckGameUpdateRecord[] = [];
	private finished = false;

	private constructor(runId: string, triggerSource: AutoCheckTriggerSource) {
		this.runId = runId;
		this.triggerSource = triggerSource;
	}

	static async start(triggerSource: AutoCheckTriggerSource): Promise<AutoCheckRunRecorder | null> {
		const runId = crypto.randomUUID();
		try {
			await db.insert(table.autoCheckRun).values({
				id: runId,
				triggerSource,
				status: 'running',
				startedAt: new Date()
			});
			return new AutoCheckRunRecorder(runId, triggerSource);
		} catch (error) {
			appLogWarn('db', 'auto-check run : impossible de créer le run (migration ?)', error);
			return null;
		}
	}

	recordGameUpdate(update: AutoCheckGameUpdateRecord) {
		this.gameUpdates.push(update);
	}

	async finish(result: AutoCheckResult, durationMs: number) {
		if (this.finished) return;
		this.finished = true;

		try {
			const status = resolveRunStatus(result);
			const finishedAt = new Date();

			await db
				.update(table.autoCheckRun)
				.set({
					status,
					scannedGames: result.scannedGames,
					updatedGames: result.updatedGames,
					updatedTranslations: result.updatedTranslations,
					alignedGames: result.disabledAlignedGames,
					translatorWebhooksSent: result.translatorWebhooksSent,
					proofreaderWebhooksSent: result.proofreaderWebhooksSent,
					issueCount: result.issues.length,
					durationMs,
					finishedAt
				})
				.where(eq(table.autoCheckRun.id, this.runId));

			const items: Array<typeof table.autoCheckRunItem.$inferInsert> = [];

			for (const game of this.gameUpdates) {
				items.push({
					runId: this.runId,
					kind: 'game_update',
					gameId: game.gameId,
					gameName: game.gameName,
					threadId: game.threadId,
					oldVersion: game.oldVersion,
					newVersion: game.newVersion,
					detail:
						game.updatedTranslations > 0
							? `${game.updatedTranslations} traduction(s) synchronisée(s)`
							: null
				});
			}

			for (const issue of result.issues) {
				items.push({
					runId: this.runId,
					kind: 'issue',
					gameId: issue.gameId ?? null,
					gameName: issue.gameName ?? null,
					threadId: issue.threadId ?? null,
					stage: issue.stage,
					message: issue.message,
					detail: issue.detail ?? null
				});
			}

			if (items.length > 0) {
				await db.insert(table.autoCheckRunItem).values(items);
			}

			if (result.issues.length > 0) {
				await notifyAutoCheckIssues(this.runId, result, this.triggerSource);
			}
		} catch (error) {
			appLogWarn('db', 'auto-check run : échec persistance du run', error);
		}
	}

	async fail(error: unknown) {
		if (this.finished) return;
		this.finished = true;

		const detail = error instanceof Error ? error.message : String(error);
		try {
			await db
				.update(table.autoCheckRun)
				.set({
					status: 'failed',
					fatalError: detail,
					finishedAt: new Date()
				})
				.where(eq(table.autoCheckRun.id, this.runId));

			await db.insert(table.autoCheckRunItem).values({
				runId: this.runId,
				kind: 'issue',
				stage: 'run',
				message: "Exécution de l'auto-check échouée",
				detail
			});

			await notifyAutoCheckIssues(
				this.runId,
				{
					scannedGames: 0,
					updatedGames: 0,
					updatedTranslations: 0,
					disabledAlignedGames: 0,
					translatorDmsSent: 0,
					translatorWebhooksSent: 0,
					proofreaderWebhooksSent: 0,
					issues: [
						{
							stage: 'checker_fetch',
							message: "Exécution de l'auto-check échouée",
							detail
						}
					]
				},
				this.triggerSource
			);
		} catch (persistError) {
			appLogWarn('db', 'auto-check run : échec persistance erreur fatale', persistError);
		}
	}
}
