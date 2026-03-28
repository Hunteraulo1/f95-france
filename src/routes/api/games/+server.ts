import { db } from '$lib/server/db';
import { game } from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const games = await db.select().from(game);
		return json(games);
	} catch (error) {
		console.error('Error fetching games:', error);
		return json({ error: 'Failed to fetch games' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { name, tags, image, description, website, threadId, link } = await request.json();

		if (!name || typeof name !== 'string') {
			return json({ error: 'Name is required' }, { status: 400 });
		}

		await db.insert(game).values({
			name: name.trim(),
			tags: tags.trim(),
			image: image.trim(),
			description: description.trim(),
			website: website.trim(),
			threadId: threadId ? parseInt(threadId) : null,
			link: link.trim()
		});

		return json({ success: true, name: name.trim() }, { status: 201 });
	} catch (error) {
		console.error('Error creating game:', error);
		return json({ error: 'Failed to create game' }, { status: 500 });
	}
};
