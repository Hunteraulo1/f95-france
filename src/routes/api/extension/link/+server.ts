import { extensionLinkCorsHeaders } from '$lib/server/extension-api-cors';
import { redeemLinkCode } from '$lib/server/extension-link';
import { isExtensionOriginAllowed } from '$lib/server/extension-origin';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const corsHeaders = extensionLinkCorsHeaders;

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, { status: 204, headers: corsHeaders });
};

export const POST: RequestHandler = async ({ request }) => {
	if (!isExtensionOriginAllowed(request)) {
		return json({ error: 'Origine non autorisée.' }, { status: 403, headers: corsHeaders });
	}

	const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
	const code = typeof body?.code === 'string' ? body.code : '';

	if (!code.trim()) {
		return json({ error: 'Code de liaison requis.' }, { status: 400, headers: corsHeaders });
	}

	const result = await redeemLinkCode(code);
	if (!result.ok) {
		const message =
			result.reason === 'expired'
				? 'Code de liaison expiré. Générez-en un nouveau depuis vos paramètres.'
				: 'Code de liaison invalide ou déjà utilisé.';
		return json({ error: message }, { status: 400, headers: corsHeaders });
	}

	// `token` : clé bearer à envoyer en `Authorization: Bearer …` vers /api/extension/*.
	return json({ token: result.rawKey }, { headers: corsHeaders });
};
