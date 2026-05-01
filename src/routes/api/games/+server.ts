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

export const GET: RequestHandler = async () => {
	try {
		const games = await db.select().from(game);
		return json(games, { headers: corsHeaders });
	} catch (error) {
		console.error('Error fetching games:', error);
		return json({ error: 'Failed to fetch games' }, { status: 500, headers: corsHeaders });
	}
};

/** Écriture interdite sur l’API publique : utiliser le tableau de bord. */
export const POST: RequestHandler = async () =>
	json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
