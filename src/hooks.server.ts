import * as auth from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';

const handleAuth: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get(auth.sessionCookieName);
	// console.log('🔍 Auth - Session token:', sessionToken ? 'présent' : 'absent');

	if (!sessionToken) {
		// console.log('🔍 Auth - Aucun token de session, user = null');
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event, {
			transformPageChunk: ({ html }) => {
				// Injecter le thème par défaut si pas d'utilisateur
				return html.replace('<html lang="en">', '<html lang="en" data-theme="light">');
			}
		});
	}

	try {
		const { session, user } = await auth.validateSessionToken(sessionToken);
		// console.log('🔍 Auth - Validation session:', { 
		// 	sessionValid: !!session, 
		// 	userValid: !!user, 
		// 	username: user?.username 
		// });

		if (session && user) {
			event.locals.user = user;
			event.locals.session = session;
			// console.log('🔍 Auth - Session validée, user défini:', user.username);
		} else {
			// console.log('🔍 Auth - Session invalide, suppression cookie');
			auth.deleteSessionTokenCookie(event);
			event.locals.user = null;
			event.locals.session = null;
		}
	} catch (error) {
		console.error('🔍 Auth - Erreur lors de la validation de session:', error);
		auth.deleteSessionTokenCookie(event);
		event.locals.user = null;
		event.locals.session = null;
	}

	// Injecter le thème de l'utilisateur dans le HTML
	const theme = event.locals.user?.theme || 'light';
	return resolve(event, {
		transformPageChunk: ({ html }) => {
			return html.replace('<html lang="en">', `<html lang="en" data-theme="${theme}">`);
		}
	});
};

export const handle: Handle = handleAuth;
