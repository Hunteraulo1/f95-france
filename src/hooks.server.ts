import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import { apiLog } from '$lib/server/db/schema';
import { logApiAction } from '$lib/server/logger';
import { notifyApiError } from '$lib/server/notifications';
import type { Handle, RequestEvent } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';

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
	const isSubmissionRoute = 
		event.url.pathname.startsWith('/dashboard/submit') || 
		event.url.pathname.startsWith('/dashboard/submits');
	const shouldLog = isApiRequest || isDashboardAction || isSubmissionRoute;
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
		const route = `${event.url.pathname}${event.url.search}`;
		
		// Logger l'action API
		logApiAction({
			method,
			route,
			status: response.status,
			userId: event.locals.user?.id ?? null,
			payload: capturedBody,
			errorMessage: null // Sera rempli par handleError pour les erreurs 500
		}).catch((error) => {
			console.error('Erreur lors de la sauvegarde du log API:', error);
		});

		// Notifier les superadmins si le statut est une erreur (4xx ou 5xx)
		// Les codes 2xx (200, 201, 204, etc.) sont des succès et ne doivent pas être notifiés
		if (response.status >= 400) {
			notifyApiError(
				method,
				route,
				response.status,
				event.locals.user?.id ?? null,
				event.locals.user?.username ?? null
			).catch((error) => {
				console.error('Erreur lors de la création de la notification d\'erreur API:', error);
			});
		}
	}

	return response;
};

export const handleError = async ({ error, event, status, message }: { error: unknown; event: RequestEvent; status: number; message: string }) => {
	const method = event.request.method.toUpperCase();
	const isApiRequest = event.url.pathname.startsWith('/api/');
	const isDashboardAction =
		event.url.pathname.startsWith('/dashboard') && !['GET', 'HEAD', 'OPTIONS'].includes(method);
	const isSubmissionRoute = 
		event.url.pathname.startsWith('/dashboard/submit') || 
		event.url.pathname.startsWith('/dashboard/submits');
	const shouldLog = isApiRequest || isDashboardAction || isSubmissionRoute;

	if (shouldLog && status >= 500) {
		const route = `${event.url.pathname}${event.url.search}`;
		
		// Construire le message d'erreur avec la stack trace
		let errorMessage = message || 'Erreur inconnue';
		if (error instanceof Error) {
			errorMessage = `${error.message}${error.stack ? `\n\nStack trace:\n${error.stack}` : ''}`;
		} else if (error) {
			errorMessage = String(error);
		}

		// Mettre à jour le dernier log pour cette route avec le message d'erreur
		try {
			const recentLogs = await db
				.select({ id: apiLog.id })
				.from(apiLog)
				.where(eq(apiLog.route, route))
				.orderBy(desc(apiLog.createdAt))
				.limit(1);

			if (recentLogs.length > 0) {
				await db
					.update(apiLog)
					.set({
						errorMessage: errorMessage.length > 10000 ? `${errorMessage.slice(0, 10000)}…` : errorMessage
					})
					.where(eq(apiLog.id, recentLogs[0].id));
			}
		} catch (dbError) {
			console.error('Erreur lors de la mise à jour du log avec le message d\'erreur:', dbError);
		}
	}

	return {
		message,
		status
	};
};
