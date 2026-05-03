import { parseTranslatorCountFilters } from '$lib/server/api/translator-count-filters';
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

export const GET: RequestHandler = async ({ url }) => {
	try {
		const filters = parseTranslatorCountFilters(url.searchParams);
		if (!filters.ok) {
			return json({ error: filters.message }, { status: 400, headers: corsHeaders });
		}

		const selectTranslators = () =>
			db
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

		const translators = await (filters.where
			? selectTranslators().where(filters.where)
			: selectTranslators());
		return json(translators, { headers: corsHeaders });
	} catch (error) {
		console.error('Error fetching translators:', error);
		return json({ error: 'Impossible de récupérer les traducteurs.' }, { status: 500, headers: corsHeaders });
	}
};

/** Écriture interdite sur l’API publique. */
export const POST: RequestHandler = async () =>
	json({ error: 'Méthode non autorisée.' }, { status: 405, headers: corsHeaders });
