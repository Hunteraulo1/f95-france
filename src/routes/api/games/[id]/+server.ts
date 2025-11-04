import { db } from '$lib/server/db';
import { game } from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const gameId = params.id;
	
	if (!gameId) {
		return json({ error: 'Game ID is required' }, { status: 400 });
	}

	try {
		const selectedGame = await db.select().from(game).where(eq(game.id, gameId));
		if (selectedGame.length === 0) {
			return json({ error: 'Game not found' }, { status: 404 });
		}
		return json(selectedGame[0]);
	} catch (error) {
		console.error('Error fetching game:', error);
		return json({ error: 'Failed to fetch game' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const gameId = params.id;
	
  try {
    const { name, tags, image, description, website, threadId, link } = await request.json();
    
    if (!gameId) {
      return json({ error: 'Game ID is required' }, { status: 400 });
    }
    
    if (!name || typeof name !== 'string') {
      return json({ error: 'Name is required' }, { status: 400 });
    }
    
    await db.update(game).set({
      name: name.trim(),
      tags: tags.trim(),
      image: image.trim(),
      description: description.trim(),
      website: website.trim(),
      threadId: threadId ? parseInt(threadId) : null,
      link: link.trim()
    }).where(eq(game.id, gameId));

    return json({ success: true, name: name.trim() }, { status: 201 });
  } catch (error) {
    console.error('Error updating game:', error);
    return json({ error: 'Failed to update game' }, { status: 500 });
  }
};
