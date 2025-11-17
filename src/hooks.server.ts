import * as auth from '$lib/server/auth';
import { logApiAction } from '$lib/server/logger';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get(auth.sessionCookieName);

	if (!sessionToken) {
		event.locals.user = null;
		event.locals.session = null;
	} else {
		try {
			const { session, user } = await auth.validateSessionToken(sessionToken);

			if (session && user) {
				event.locals.user = user;
				event.locals.session = session;
			} else {
				auth.deleteSessionTokenCookie(event);
				event.locals.user = null;
				event.locals.session = null;
			}
		} catch (error) {
			console.error('Erreur lors de la validation de session:', error);
			auth.deleteSessionTokenCookie(event);
			event.locals.user = null;
			event.locals.session = null;
		}
	}

	let capturedBody: string | null = null;
	const method = event.request.method.toUpperCase();
	const isApiRequest = event.url.pathname.startsWith('/api/');
	const isDashboardAction =
		event.url.pathname.startsWith('/dashboard') && !['GET', 'HEAD', 'OPTIONS'].includes(method);
	const shouldLog = isApiRequest || isDashboardAction;
	const shouldCaptureBody = shouldLog && !['GET', 'HEAD', 'OPTIONS'].includes(method);

	if (shouldCaptureBody) {
		try {
			const clone = event.request.clone();
			const bodyText = await clone.text();
			const trimmed = bodyText.trim();
			if (trimmed.length > 0) {
				capturedBody = trimmed.length > 4000 ? `${trimmed.slice(0, 4000)}…` : trimmed;
			}
		} catch (error) {
			console.error('Impossible de lire le corps de la requête pour les logs:', error);
		}
	}

	const response = await resolve(event);

	if (shouldLog) {
		logApiAction({
			method,
			route: `${event.url.pathname}${event.url.search}`,
			status: response.status,
			userId: event.locals.user?.id ?? null,
			payload: capturedBody
		}).catch((error) => {
			console.error('Erreur lors de la sauvegarde du log API:', error);
		});
	}

	return response;
};
