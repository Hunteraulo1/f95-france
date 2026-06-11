import { env } from '$env/dynamic/private';
import { logApp } from '$lib/server/app-logger';
import { runAutoCheckVersions } from '$lib/server/check-version';
import { cronAuthFailureMessage, verifyCronAuth } from '$lib/server/cron-auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

function parseCronMaxWaitMs(raw: string | undefined): number {
	const parsed = Number.parseInt((raw ?? '').trim(), 10);
	// garde une marge sous 30s pour les limites de cron providers
	if (Number.isFinite(parsed) && parsed >= 1_000 && parsed <= 29_000) return parsed;
	return 25_000;
}

async function handleCheckVersion(request: Request): Promise<Response> {
	const auth = verifyCronAuth(request);
	if (!auth.ok) {
		logApp({
			level: 'warn',
			source: 'cron',
			message: 'check-version : authentification refusée',
			meta: { reason: auth.reason }
		});
		return json(
			{
				error: 'Unauthorized',
				reason: auth.reason,
				message: cronAuthFailureMessage(auth.reason)
			},
			{ status: 401 }
		);
	}

	const startedAt = Date.now();

	try {
		const maxWaitMs = parseCronMaxWaitMs(env.CRON_MAX_WAIT_MS);
		const runPromise = runAutoCheckVersions({ logSource: 'cron' });
		const timeoutResult = await Promise.race([
			runPromise
				.then((result) => ({ kind: 'done' as const, result }))
				.catch((error) => ({
					kind: 'error' as const,
					error
				})),
			new Promise<{ kind: 'timeout' }>((resolve) => {
				setTimeout(() => resolve({ kind: 'timeout' }), maxWaitMs);
			})
		]);

		if (timeoutResult.kind === 'timeout') {
			// Continue l’exécution en arrière-plan ; réponse rapide pour éviter l’échec cron.
			void runPromise
				.then(async () => {
					const finishedAt = new Date();
					await db
						.update(table.config)
						.set({ autoCheckLastRunAt: finishedAt, updatedAt: finishedAt })
						.where(eq(table.config.id, 'main'));
				})
				.catch((error) => {
					logApp({
						level: 'error',
						source: 'cron',
						message: 'check-version : échec async après timeout',
						meta: {
							detail: error instanceof Error ? error.message : String(error)
						}
					});
				});

			return json(
				{
					ok: true,
					accepted: true,
					reason: 'processing_in_background',
					timeoutMs: maxWaitMs
				},
				{ status: 202 }
			);
		}

		if (timeoutResult.kind === 'error') {
			logApp({
				level: 'error',
				source: 'cron',
				message: 'check-version : runAutoCheckVersions a échoué',
				meta: {
					detail:
						timeoutResult.error instanceof Error
							? timeoutResult.error.message
							: String(timeoutResult.error)
				}
			});
			return json(
				{
					ok: false,
					error: 'Auto-check failed',
					errorReport: [
						{
							stage: 'run',
							message: 'Exécution check-version échouée',
							detail:
								timeoutResult.error instanceof Error
									? timeoutResult.error.message
									: String(timeoutResult.error)
						}
					]
				},
				{ status: 200 }
			);
		}

		const finishedAt = new Date();
		await db
			.update(table.config)
			.set({ autoCheckLastRunAt: finishedAt, updatedAt: finishedAt })
			.where(eq(table.config.id, 'main'));

		const durationMs = finishedAt.getTime() - startedAt;

		return json({
			ok: true,
			...timeoutResult.result,
			errorCount: timeoutResult.result.issues.length,
			durationMs
		});
	} catch (error) {
		logApp({
			level: 'error',
			source: 'cron',
			message: 'check-version : erreur inattendue',
			meta: { detail: error instanceof Error ? error.message : String(error) }
		});
		return json({ ok: false, error: 'Auto-check failed' }, { status: 500 });
	}
}

export const POST: RequestHandler = async ({ request }) => handleCheckVersion(request);

/** Compatibilité avec les planificateurs configurés en GET. */
export const GET: RequestHandler = async ({ request }) => handleCheckVersion(request);
