import { db } from '$lib/server/db';

import { json } from '@sveltejs/kit';

import { sql } from 'drizzle-orm';

export const prerender = false;

/**
 * Diag  applicatif : GET /api/health
 * On check que l'app répond et que la lisaon DB est OK
 * Pas pour Coolify
 */
export async function GET() {
	const startedAt = Date.now();

	try {
		await db.execute(sql`SELECT 1`);

		return json(
			{
				status: 'ok',
				service: 'f95-france',
				app: 'up',
				database: 'up',
				responseTimeMs: Date.now() - startedAt,
				timestamp: new Date().toISOString()
			},
			{
				status: 200,
				headers: {
					'cache-control': 'no-store'
				}
			}
		);
	} catch (error) {
		console.error('[healthcheck:api]', error);

		return json(
			{
				status: 'error',
				service: 'f95-france',
				app: 'up',
				database: 'down',
				responseTimeMs: Date.now() - startedAt,
				timestamp: new Date().toISOString()
			},
			{
				status: 503,
				headers: {
					'cache-control': 'no-store'
				}
			}
		);
	}
}
