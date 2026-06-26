import { extensionReadCorsHeaders } from '$lib/server/extension-api-cors';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const corsHeaders = extensionReadCorsHeaders;

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, { status: 204, headers: corsHeaders });
};

export const GET: RequestHandler = async ({ locals }) => {
	// `locals.user` est résolu par le hook à partir de la clé bearer (owner → user).
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401, headers: corsHeaders });
	}

	return json({ role: locals.user.role }, { headers: corsHeaders });
};
