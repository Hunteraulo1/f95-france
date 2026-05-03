import { translationsByGameIds } from '$lib/server/api/games-with-translations';
import { parseInclude } from '$lib/server/api/include-query';
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

export const GET: RequestHandler = async ({ params, url }) => {
	const gameId = params.id;

	if (!gameId) {
		return json({ error: "L'identifiant du jeu est requis." }, { status: 400, headers: corsHeaders });
	}

	try {
		const selectedGame = await db.select().from(game).where(eq(game.id, gameId));
		if (selectedGame.length === 0) {
			return json({ error: 'Jeu introuvable.' }, { status: 404, headers: corsHeaders });
		}
		const g = selectedGame[0];
		if (!parseInclude(url.searchParams).has('translations')) {
			return json(g, { headers: corsHeaders });
		}
		const byGame = await translationsByGameIds([g.id]);
		return json(
			{ ...g, translations: byGame.get(g.id) ?? [] },
			{ headers: corsHeaders }
		);
	} catch (error) {
		console.error('Error fetching game:', error);
		return json({ error: 'Impossible de récupérer le jeu.' }, { status: 500, headers: corsHeaders });
	}
};

/** Écriture interdite sur l’API publique : utiliser le tableau de bord. */
export const PUT: RequestHandler = async () =>
	json({ error: 'Méthode non autorisée.' }, { status: 405, headers: corsHeaders });
