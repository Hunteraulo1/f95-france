import { db } from '$lib/server/db';
import { game } from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const OPTIONS: RequestHandler = async () =>
	new Response(null, {
		status: 204,
		headers: corsHeaders
	});

export const GET: RequestHandler = async ({ params }) => {
	const gameId = params.id;

	if (!gameId) {
		return json({ error: 'Game ID is required' }, { status: 400, headers: corsHeaders });
	}

	try {
		const selectedGame = await db.select().from(game).where(eq(game.id, gameId));
		if (selectedGame.length === 0) {
			return json({ error: 'Game not found' }, { status: 404, headers: corsHeaders });
		}
		return json(selectedGame[0], { headers: corsHeaders });
	} catch (error) {
		console.error('Error fetching game:', error);
		return json({ error: 'Failed to fetch game' }, { status: 500, headers: corsHeaders });
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const gameId = params.id;

	try {
		const { name, tags, image, description, website, threadId, link } = await request.json();

		if (!gameId) {
			return json({ error: 'Game ID is required' }, { status: 400, headers: corsHeaders });
		}

		if (!name || typeof name !== 'string') {
			return json({ error: 'Name is required' }, { status: 400, headers: corsHeaders });
		}

		await db
			.update(game)
			.set({
				name: name.trim(),
				tags: tags.trim(),
				image: image.trim(),
				description: description.trim(),
				website: website.trim(),
				threadId: threadId ? parseInt(threadId) : null,
				link: link.trim()
			})
			.where(eq(game.id, gameId));

		return json({ success: true, name: name.trim() }, { status: 201, headers: corsHeaders });
	} catch (error) {
		console.error('Error updating game:', error);
		return json({ error: 'Failed to update game' }, { status: 500, headers: corsHeaders });
	}
};
