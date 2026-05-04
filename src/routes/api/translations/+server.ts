import { parseTranslationListFilters } from '$lib/server/api/translation-list-filters';
import { db } from '$lib/server/db';
import { gameTranslation } from '$lib/server/db/schema';
import { json } from '@sveltejs/kit';
import { desc } from 'drizzle-orm';
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

export const GET: RequestHandler = async ({ url }) => {
	try {
		const filters = parseTranslationListFilters(url.searchParams);
		if (!filters.ok) {
			return json({ error: filters.message }, { status: 400, headers: corsHeaders });
		}

		const rows = await (filters.where
			? db.select().from(gameTranslation).where(filters.where)
			: db.select().from(gameTranslation)
		).orderBy(desc(gameTranslation.updatedAt));

		return json(rows, { headers: corsHeaders });
	} catch (error) {
		console.error('Error fetching translations:', error);
		return json({ error: 'Impossible de récupérer les traductions.' }, { status: 500, headers: corsHeaders });
	}
};
