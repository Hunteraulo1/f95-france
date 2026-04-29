import { getGoogleAuthUrl } from '$lib/server/google-oauth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	// Endpoint sensible: superadmin uniquement
	if (!locals.user) {
		throw redirect(302, '/dashboard/login');
	}
	if (locals.user.role !== 'superadmin') {
		throw new Error('Accès non autorisé (superadmin requis)');
	}

	// Charger la configuration
	const configResult = await db
		.select()
		.from(table.config)
		.where(eq(table.config.id, 'main'))
		.limit(1);

	const config = configResult[0];
	if (!config?.googleOAuthClientId) {
		throw new Error('Client ID OAuth2 non configuré');
	}

	// Construire l'URL de redirection
	const redirectUri = `${url.origin}/api/google-oauth/callback`;
	const state = crypto.randomUUID(); // Pour la sécurité CSRF

	// Générer l'URL d'autorisation
	const authUrl = getGoogleAuthUrl(config.googleOAuthClientId, redirectUri, state);

	// Rediriger vers Google
	throw redirect(302, authUrl);
};
