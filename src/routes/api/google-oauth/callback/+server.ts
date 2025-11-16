import { exchangeCodeForToken, saveOAuthTokens } from '$lib/server/google-oauth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	// Vérifier que l'utilisateur est admin
	if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
		throw new Error('Accès non autorisé');
	}

	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');

	if (error) {
		throw redirect(302, `/dashboard/config?oauth_error=${encodeURIComponent(error)}`);
	}

	if (!code) {
		throw redirect(302, '/dashboard/config?oauth_error=no_code');
	}

	try {
		// Charger la configuration
		const configResult = await db
			.select()
			.from(table.config)
			.where(eq(table.config.id, 'main'))
			.limit(1);

		const config = configResult[0];
		if (!config?.googleOAuthClientId || !config?.googleOAuthClientSecret) {
			throw new Error('OAuth2 non configuré');
		}

		// Construire l'URL de redirection
		const redirectUri = `${url.origin}/api/google-oauth/callback`;

		// Échanger le code contre un token
		const tokenResponse = await exchangeCodeForToken(
			code,
			config.googleOAuthClientId,
			config.googleOAuthClientSecret,
			redirectUri
		);

		// Sauvegarder les tokens
		await saveOAuthTokens(
			tokenResponse.access_token,
			tokenResponse.refresh_token,
			tokenResponse.expires_in
		);

		// Rediriger vers la page de configuration avec un message de succès
		throw redirect(302, '/dashboard/config?oauth_success=true');
	} catch (error: unknown) {
		console.error('Erreur lors de l\'autorisation OAuth2:', error);
		const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
		throw redirect(302, `/dashboard/config?oauth_error=${encodeURIComponent(errorMessage)}`);
	}
};
