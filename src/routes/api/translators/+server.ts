import { db } from '$lib/server/db';
import { translator } from '$lib/server/db/schema';
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
		// Projection explicite: ne jamais exposer de liaison interne userId.
		const translators = await db
			.select({
				id: translator.id,
				name: translator.name,
				discordId: translator.discordId,
				pages: translator.pages,
				tradCount: translator.tradCount,
				readCount: translator.readCount,
				createdAt: translator.createdAt,
				updatedAt: translator.updatedAt
			})
			.from(translator);
		return json(translators, { headers: corsHeaders });
	} catch (error) {
		console.error('Error fetching translators:', error);
		return json({ error: 'Failed to fetch translators' }, { status: 500, headers: corsHeaders });
	}
};

/** Écriture interdite sur l’API publique : utiliser le tableau de bord. */
export const POST: RequestHandler = async () =>
	json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
