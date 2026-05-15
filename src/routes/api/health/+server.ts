import { db } from '$lib/server/db';
import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';

export async function GET() {
	try {
		await db.execute(sql`SELECT 1`);

		return json(
			{
				status: 'ok',
				database: 'up',
				timestamp: new Date().toISOString()
			},
			{
				status: 200
			}
		);
	} catch (error) {
		console.error(error);

		return json(
			{
				status: 'error',
				database: 'down'
			},
			{
				status: 503
			}
		);
	}
}
