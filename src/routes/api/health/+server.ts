import { db } from '$lib/server/db';
import { privateEnv } from '$lib/server/private-env';
import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';

function extractHealthToken(request: Request): string {
	const auth = request.headers.get('authorization')?.trim() ?? '';
	if (auth.toLowerCase().startsWith('bearer ')) {
		return auth.slice(7).trim();
	}
	return (
		request.headers.get('x-health-token')?.trim() ??
		request.headers.get('x-cron-secret')?.trim() ??
		''
	);
}

function isAuthorizedHealthProbe(request: Request): boolean {
	const expected =
		privateEnv('HEALTH_CHECK_TOKEN')?.trim() || privateEnv('CRON_SECRET')?.trim() || '';
	if (!expected) {
		return process.env.NODE_ENV !== 'production';
	}
	const token = extractHealthToken(request);
	if (!token) return false;
	const a = Buffer.from(token, 'utf8');
	const b = Buffer.from(expected, 'utf8');
	return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET({ request }) {
	if (!isAuthorizedHealthProbe(request)) {
		return json({ error: 'Not found' }, { status: 404 });
	}

	try {
		await db.execute(sql`SELECT 1`);

		return json(
			{
				status: 'ok',
				database: 'up',
				timestamp: new Date().toISOString()
			},
			{ status: 200 }
		);
	} catch (error) {
		console.error(error);

		return json(
			{
				status: 'error',
				database: 'down'
			},
			{ status: 503 }
		);
	}
}
