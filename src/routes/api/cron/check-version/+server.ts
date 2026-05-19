import { env } from '$env/dynamic/private';
import { runAutoCheckVersions } from '$lib/server/check-version';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from './$types';

function safeCompareToken(a: string, b: string): boolean {
	const bufA = Buffer.from(a, 'utf8');
	const bufB = Buffer.from(b, 'utf8');
	return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function hasCronAuth(request: Request): boolean {
	const secret = env.CRON_SECRET?.trim();
	if (!secret) return false;

	const uaRule = env.CRON_ALLOWED_USER_AGENT?.trim();
	if (uaRule) {
		const ua = request.headers.get('user-agent') ?? '';
		if (!ua.includes(uaRule)) return false;
	}

	const authHeader = request.headers.get('authorization')?.trim();
	const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
	return safeCompareToken(bearer, secret);
}

function parseCronMaxWaitMs(raw: string | undefined): number {
	const parsed = Number.parseInt((raw ?? '').trim(), 10);
	// garde une marge sous 30s pour les limites de cron providers
	if (Number.isFinite(parsed) && parsed >= 1_000 && parsed <= 29_000) return parsed;
	return 25_000;
}

export const POST: RequestHandler = async ({ request }) => {
	if (!hasCronAuth(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	console.info('[cron/check-version] déclenché à', new Date().toISOString());

	const startedAt = Date.now();

	try {
		const maxWaitMs = parseCronMaxWaitMs(env.CRON_MAX_WAIT_MS);
		const runPromise = runAutoCheckVersions();
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
					console.error('[cron/check-version] échec async après timeout:', error);
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
			// On évite de faire échouer le cron provider (500) sur une dépendance externe instable.
			console.error('[cron/check-version] runAutoCheckVersions a échoué:', timeoutResult.error);
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

		return json({
			ok: true,
			...timeoutResult.result,
			errorCount: timeoutResult.result.issues.length,
			durationMs: finishedAt.getTime() - startedAt
		});
	} catch (error) {
		console.error('[cron/check-version] erreur:', error);
		return json({ ok: false, error: 'Auto-check failed' }, { status: 500 });
	}
};
