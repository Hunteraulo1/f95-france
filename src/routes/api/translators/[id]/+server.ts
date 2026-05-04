import { db } from '$lib/server/db';
import { translator } from '$lib/server/db/schema';
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
	const id = params.id;

	if (!id) {
		return json({ error: "L'identifiant du traducteur est requis." }, { status: 400, headers: corsHeaders });
	}

	try {
		const rows = await db
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
			.from(translator)
			.where(eq(translator.id, id))
			.limit(1);

		if (rows.length === 0) {
			return json({ error: 'Traducteur introuvable.' }, { status: 404, headers: corsHeaders });
		}

		return json(rows[0], { headers: corsHeaders });
	} catch (error) {
		console.error('Error fetching translator:', error);
		return json({ error: 'Impossible de récupérer le traducteur.' }, { status: 500, headers: corsHeaders });
	}
};
