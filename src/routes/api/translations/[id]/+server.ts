import { db } from '$lib/server/db';
import { gameTranslation } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const translationId = params.id;

	if (!translationId) {
		return json({ error: 'Translation ID is required' }, { status: 400 });
	}

	try {
		const rows = await db
			.select()
			.from(gameTranslation)
			.where(eq(gameTranslation.id, translationId))
			.limit(1);

		if (rows.length === 0) {
			return json({ error: 'Translation not found' }, { status: 404 });
		}

		return json(rows[0]);
	} catch (error) {
		console.error('Error fetching translation:', error);
		return json({ error: 'Failed to fetch translation' }, { status: 500 });
	}
};
