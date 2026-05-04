import { db } from '$lib/server/db';
import { gameTranslation } from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key'
};

export const OPTIONS: RequestHandler = async () =>
	new Response(null, {
		status: 204,
		headers: corsHeaders
	});

export const GET: RequestHandler = async ({ params }) => {
	const translationId = params.id;

	if (!translationId) {
		return json(
			{ error: "L'identifiant de la traduction est requis." },
			{ status: 400, headers: corsHeaders }
		);
	}

	try {
		const rows = await db
			.select()
			.from(gameTranslation)
			.where(eq(gameTranslation.id, translationId))
			.limit(1);

		if (rows.length === 0) {
			return json({ error: 'Traduction introuvable.' }, { status: 404, headers: corsHeaders });
		}

		return json(rows[0], { headers: corsHeaders });
	} catch (error) {
		console.error('Error fetching translation:', error);
		return json(
			{ error: 'Impossible de récupérer la traduction.' },
			{ status: 500, headers: corsHeaders }
		);
	}
};
