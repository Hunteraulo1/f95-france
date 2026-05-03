import { translationsByGameIds } from '$lib/server/api/games-with-translations';
import { parseInclude } from '$lib/server/api/include-query';
import { db } from '$lib/server/db';
import { game } from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
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

export const GET: RequestHandler = async ({ url }) => {
	try {
		const games = await db.select().from(game);
		if (!parseInclude(url.searchParams).has('translations')) {
			return json(games, { headers: corsHeaders });
		}
		const byGame = await translationsByGameIds(games.map((g) => g.id));
		const payload = games.map((g) => ({
			...g,
			translations: byGame.get(g.id) ?? []
		}));
		return json(payload, { headers: corsHeaders });
	} catch (error) {
		console.error('Error fetching games:', error);
		return json({ error: 'Impossible de récupérer les jeux.' }, { status: 500, headers: corsHeaders });
	}
};

/** Écriture interdite sur l’API publique : utiliser le tableau de bord. */
export const POST: RequestHandler = async () =>
	json({ error: 'Méthode non autorisée.' }, { status: 405, headers: corsHeaders });
