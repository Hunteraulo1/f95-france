import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import { eq, like, or } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	const query = url.searchParams.get('q');
	
	if (!query || query.trim().length === 0) {
		return json({ games: [] });
	}

	try {
		// Rechercher par nom de jeu ou par threadId
		const games = await db
			.select({
				id: table.games.id,
				name: table.games.name,
				description: table.games.description,
				website: table.games.website,
				threadId: table.games.threadId,
				link: table.games.link,
				tags: table.games.tags,
				type: table.games.type,
				image: table.games.image,
				createdAt: table.games.createdAt,
				updatedAt: table.games.updatedAt
			})
			.from(table.games)
			.where(
				or(
					like(table.games.name, `%${query}%`),
					eq(table.games.threadId, parseInt(query) || 0)
				)
			)
			.orderBy(table.games.name)
			.limit(20);

		return json({ games });
	} catch (error) {
		console.error('Erreur lors de la recherche des jeux:', error);
		return json({ error: 'Erreur serveur' }, { status: 500 });
	}
};
