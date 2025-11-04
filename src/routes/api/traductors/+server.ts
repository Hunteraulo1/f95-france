import { db } from '$lib/server/db';
import { translator } from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const translators = await db.select().from(translator);
		return json(translators);
	} catch (error) {
		console.error('Error fetching translators:', error);
		return json({ error: 'Failed to fetch translators' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { name } = await request.json();
		
		if (!name || typeof name !== 'string') {
			return json({ error: 'Name is required' }, { status: 400 });
		}

		await db.insert(translator).values({
			name: name.trim(),
			pages: '',
			tradCount: 0,
			readCount: 0
		});

		return json({ success: true, name: name.trim() }, { status: 201 });
	} catch (error) {
		console.error('Error creating translator:', error);
		return json({ error: 'Failed to create translator' }, { status: 500 });
	}
};
