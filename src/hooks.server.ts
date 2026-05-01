import * as auth from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { logApiAction } from '$lib/server/logger';
import { notifyApiError } from '$lib/server/notifications';
import type { Handle, RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

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

	// Mode maintenance global: autoriser uniquement les superadmins.
	// Exceptions: pages auth pour permettre la connexion/déconnexion.
	try {
		const [cfg] = await db.select().from(table.config).where(eq(table.config.id, 'main')).limit(1);
		const maintenanceEnabled = cfg?.maintenanceMode === true;
		if (maintenanceEnabled) {
			const path = event.url.pathname;
			const isAuthException =
				path === '/dashboard/login' || path === '/dashboard/register' || path === '/dashboard/logout';
			const isSuperAdmin = event.locals.user?.role === 'superadmin';

			if (!isSuperAdmin && !isAuthException) {
				const acceptsHtml = event.request.headers.get('accept')?.includes('text/html');
				if (acceptsHtml) {
					return new Response(
						'<h1>Maintenance</h1><p>Le site est temporairement en maintenance.</p>',
						{
							status: 503,
							headers: {
								'content-type': 'text/html; charset=utf-8',
								'retry-after': '600'
							}
						}
					);
				}
				return new Response(JSON.stringify({ error: 'Service en maintenance' }), {
					status: 503,
					headers: { 'content-type': 'application/json; charset=utf-8', 'retry-after': '600' }
				});
			}
		}
	} catch (error) {
		console.warn('Maintenance check skipped:', error);
	}

	let capturedBody: string | null = null;
	const method = event.request.method.toUpperCase();
	const pathname = event.url.pathname;

	// Exclure les fichiers statiques du logging pour éviter la surcharge
	const isStaticAsset =
		pathname.startsWith('/_app/') ||
		pathname.startsWith('/favicon') ||
		pathname.startsWith('/robots.txt') ||
		pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot)$/);

	const isApiRequest = pathname.startsWith('/api/');
	const isNotificationsApiRoute = pathname.startsWith('/api/notifications');
	const isDashboardAction =
		pathname.startsWith('/dashboard') && !['GET', 'HEAD', 'OPTIONS'].includes(method);
	const isSubmissionRoute =
		pathname.startsWith('/dashboard/submit') || pathname.startsWith('/dashboard/submits');
	const isSensitiveSettingsAction =
		pathname === '/dashboard/settings' &&
		(event.url.search.includes('/changePassword') || event.url.search.includes('/disable2FA'));
	const isSensitiveBodyRoute =
		pathname === '/dashboard/login' ||
		pathname === '/dashboard/register' ||
		pathname === '/dashboard/logout' ||
		isSensitiveSettingsAction;
	const shouldLog =
		!isStaticAsset &&
		!isNotificationsApiRoute &&
		(isApiRequest || isDashboardAction || isSubmissionRoute);
	const shouldCaptureBody =
		shouldLog && !['GET', 'HEAD', 'OPTIONS'].includes(method) && !isSensitiveBodyRoute;

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
				console.error("Erreur lors de la création de la notification d'erreur API:", error);
			});
		}
	}

	return response;
};

export const handleError = async ({
	error,
	event,
	status,
	message
}: {
	error: unknown;
	event: RequestEvent;
	status: number;
	message: string;
}) => {
	const method = event.request.method.toUpperCase();
	const pathname = event.url.pathname;

	// Exclure les fichiers statiques du logging pour éviter la surcharge
	const isStaticAsset =
		pathname.startsWith('/_app/') ||
		pathname.startsWith('/favicon') ||
		pathname.startsWith('/robots.txt') ||
		pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot)$/);

	const isApiRequest = pathname.startsWith('/api/');
	const isNotificationsApiRoute = pathname.startsWith('/api/notifications');
	const isDashboardAction =
		pathname.startsWith('/dashboard') && !['GET', 'HEAD', 'OPTIONS'].includes(method);
	const isSubmissionRoute =
		pathname.startsWith('/dashboard/submit') || pathname.startsWith('/dashboard/submits');
	const shouldLog =
		!isStaticAsset &&
		!isNotificationsApiRoute &&
		(isApiRequest || isDashboardAction || isSubmissionRoute);

	if (shouldLog && status >= 500) {
		const route = `${event.url.pathname}${event.url.search}`;

		// Construire le message d'erreur avec la stack trace
		let errorMessage = message || 'Erreur inconnue';
		if (error instanceof Error) {
			errorMessage = `${error.message}${error.stack ? `\n\nStack trace:\n${error.stack}` : ''}`;
		} else if (error) {
			errorMessage = String(error);
		}

		// Best effort: create a dedicated error log entry.
		await logApiAction({
			method,
			route,
			status,
			userId: event.locals.user?.id ?? null,
			payload: null,
			errorMessage
		});
	}

	return {
		message,
		status
	};
};
