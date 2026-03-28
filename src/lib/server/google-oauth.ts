import { db } from './db';
import * as table from './db/schema';
import { eq } from 'drizzle-orm';

interface GoogleTokenResponse {
	access_token: string;
	expires_in: number;
	refresh_token?: string;
	token_type: string;
	scope?: string;
}

/**
 * Génère l'URL d'autorisation OAuth2 pour Google
 */
export const getGoogleAuthUrl = (clientId: string, redirectUri: string, state?: string): string => {
	const scopes = [
		'https://www.googleapis.com/auth/spreadsheets.readonly',
		'https://www.googleapis.com/auth/spreadsheets'
	].join(' ');

	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: scopes,
		access_type: 'offline',
		prompt: 'consent'
	});

	if (state) {
		params.append('state', state);
	}

	return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

/**
 * Échange le code d'autorisation contre un access token
 */
export const exchangeCodeForToken = async (
	code: string,
	clientId: string,
	clientSecret: string,
	redirectUri: string
): Promise<GoogleTokenResponse> => {
	const response = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code'
		})
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: 'Unknown error' }));
		throw new Error(`Failed to exchange code: ${error.error || response.statusText}`);
	}

	return await response.json();
};

/**
 * Rafraîchit un access token expiré
 */
export const refreshAccessToken = async (
	refreshToken: string,
	clientId: string,
	clientSecret: string
): Promise<GoogleTokenResponse> => {
	const response = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			refresh_token: refreshToken,
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: 'refresh_token'
		})
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: 'Unknown error' }));
		throw new Error(`Failed to refresh token: ${error.error || response.statusText}`);
	}

	return await response.json();
};

/**
 * Obtient un access token valide (rafraîchit si nécessaire)
 */
export const getValidAccessToken = async (): Promise<string | null> => {
	const configResult = await db
		.select()
		.from(table.config)
		.where(eq(table.config.id, 'main'))
		.limit(1);

	const config = configResult[0];
	if (!config?.googleOAuthClientId || !config?.googleOAuthClientSecret) {
		return null;
	}

	// Si on a un access token valide, le retourner
	if (config.googleOAuthAccessToken && config.googleOAuthTokenExpiry) {
		const expiry = new Date(config.googleOAuthTokenExpiry);
		// Vérifier si le token expire dans moins de 5 minutes
		if (expiry > new Date(Date.now() + 5 * 60 * 1000)) {
			return config.googleOAuthAccessToken;
		}
	}

	// Si on a un refresh token, rafraîchir
	if (config.googleOAuthRefreshToken) {
		try {
			const tokenResponse = await refreshAccessToken(
				config.googleOAuthRefreshToken,
				config.googleOAuthClientId,
				config.googleOAuthClientSecret
			);

			const expiryDate = new Date(Date.now() + tokenResponse.expires_in * 1000);

			// Mettre à jour le token dans la base de données
			await db
				.update(table.config)
				.set({
					googleOAuthAccessToken: tokenResponse.access_token,
					googleOAuthTokenExpiry: expiryDate,
					// Le refresh_token peut être renvoyé, le mettre à jour si présent
					googleOAuthRefreshToken: tokenResponse.refresh_token || config.googleOAuthRefreshToken
				})
				.where(eq(table.config.id, 'main'));

			return tokenResponse.access_token;
		} catch (error) {
			console.error('Erreur lors du rafraîchissement du token:', error);
			return null;
		}
	}

	return null;
};

/**
 * Sauvegarde les tokens OAuth dans la base de données
 */
export const saveOAuthTokens = async (
	accessToken: string,
	refreshToken: string | undefined,
	expiresIn: number
): Promise<void> => {
	const expiryDate = new Date(Date.now() + expiresIn * 1000);

	await db
		.update(table.config)
		.set({
			googleOAuthAccessToken: accessToken,
			googleOAuthRefreshToken: refreshToken || null,
			googleOAuthTokenExpiry: expiryDate
		})
		.where(eq(table.config.id, 'main'));
};
