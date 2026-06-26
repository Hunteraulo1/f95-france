import { building } from '$app/environment';
import {
	apiKeyIsExtensionScoped,
	isPathAllowedForApiKeyScope,
	extractApiKeyFromRequest,
	getUserForApiKeyOwner,
	jsonApiKeyGuardResponse,
	validateApiKeyRequest
} from '$lib/server/api-keys';
import { isExtensionOriginAllowed } from '$lib/server/extension-origin';
import { apiPublicErrorCorsHeaders } from '$lib/server/api-public-cors';
import { logApp } from '$lib/server/app-logger';
import * as auth from '$lib/server/auth';
import { getRequestClientAddressOrUnknown } from '$lib/server/client-address';
import { isPublicSitePath } from '$lib/server/dashboard-auth';
import { warmHomePayload } from '$lib/server/home-page-data';
import { logApiAction } from '$lib/server/logger';
import { getMaintenanceMode } from '$lib/server/maintenance-mode';
import { notifyApiError } from '$lib/server/notifications';
import { attachPermissionsToLocals, ensurePermissionsCatalogSeeded } from '$lib/server/permissions';
import { applySecurityHeaders } from '$lib/server/security-headers';
import { touchUserLastSeen } from '$lib/server/user-last-connection';
import type { Handle, RequestEvent, ServerInit } from '@sveltejs/kit';

const EXTERNAL_PUBLIC_API_ORIGIN = 'https://api.f95france.site';

/** Ancienne API publique sur ce domaine → api.f95france.site (ou nouvelles routes internes). */
function resolveDeprecatedApiRedirect(pathname: string): string | null {
	if (pathname === '/api' || pathname === '/api/') {
		return EXTERNAL_PUBLIC_API_ORIGIN;
	}
	if (pathname === '/api/games/saved-filters' || pathname === '/api/games/saved-filters/') {
		return '/api/saved-filters/games';
	}
	if (pathname === '/api/updates/saved-filters' || pathname === '/api/updates/saved-filters/') {
		return '/api/saved-filters/updates';
	}
	for (const prefix of ['/api/games', '/api/translators', '/api/translations', '/api/updates']) {
		if (pathname === prefix || pathname === `${prefix}/` || pathname.startsWith(`${prefix}/`)) {
			return `${EXTERNAL_PUBLIC_API_ORIGIN}/v1${pathname.slice('/api'.length)}`;
		}
	}
	return null;
}

/**
 * Démarrage du serveur : ouvre la connexion DB et préchauffe le cache de la home
 * pour que le tout premier visiteur ne paie pas le coût à froid (TCP + TLS + requêtes).
 */
export const init: ServerInit = async () => {
	if (building) return;
	await warmHomePayload();
};

/** Chemin seul (sans query) — la query va dans `payload` du log API. */
function requestRouteLabel(url: URL): string {
	try {
		return url.pathname;
	} catch {
		return '/';
	}
}

function requestQueryForLog(url: URL): string | null {
	try {
		const search = url.search;
		if (!search || search === '?') return null;
		return search;
	} catch {
		return null;
	}
}

function urlSearchIncludes(url: URL, fragment: string): boolean {
	try {
		return url.search.includes(fragment);
	} catch {
		return false;
	}
}

function isStaticAssetPath(pathname: string): boolean {
	return (
		pathname.startsWith('/_app/') ||
		pathname.startsWith('/favicon') ||
		pathname.startsWith('/robots.txt') ||
		pathname === '/robot.txt' ||
		pathname === '/sitemap.xml' ||
		/\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot)$/.test(pathname)
	);
}

/** Sonde infra (Docker, Traefik, Coolify) — doit rester 200 même en maintenance. */
function isHealthCheckPath(pathname: string): boolean {
	return pathname === '/health' || pathname === '/api/health';
}

/** Routes à journaliser (API + dashboard + maintenance), hors assets et polling. */
function getRequestLoggingDecision(
	pathname: string,
	method: string,
	url: URL
): { shouldLog: boolean; shouldCaptureBody: boolean; shouldCaptureQuery: boolean } {
	const isApiRequest = pathname === '/api' || pathname.startsWith('/api/');
	const isHighFrequencyPollRoute =
		pathname.startsWith('/api/notifications') ||
		pathname === '/api/health' ||
		pathname === '/api/logs/live' ||
		pathname === '/api/logs-app/live';
	const isDashboardRoute = pathname.startsWith('/dashboard');
	const isMaintenanceRoute = pathname === '/maintenance' || pathname.startsWith('/maintenance/');
	const isSensitiveSettingsAction =
		pathname === '/dashboard/settings' &&
		(urlSearchIncludes(url, '/changePassword') || urlSearchIncludes(url, '/disable2FA'));
	const isSensitiveOAuthOrPasskeyRoute =
		pathname.startsWith('/api/google-oauth/') ||
		pathname.startsWith('/api/discord-oauth/') ||
		pathname.startsWith('/api/passkeys/');
	const isSensitiveQueryRoute =
		isSensitiveOAuthOrPasskeyRoute ||
		pathname === '/dashboard/account/login' ||
		pathname === '/dashboard/account/register' ||
		pathname === '/dashboard/account/forgot-password' ||
		pathname === '/email/reset-password' ||
		pathname === '/dashboard/settings' ||
		pathname.startsWith('/dashboard/api-keys') ||
		pathname === '/dashboard/users' ||
		pathname.startsWith('/dashboard/logs') ||
		pathname.startsWith('/dashboard/logs-app') ||
		pathname === '/logs-app';
	const isSensitiveBodyRoute =
		pathname === '/dashboard/account/login' ||
		pathname === '/dashboard/account/register' ||
		pathname === '/dashboard/account/forgot-password' ||
		pathname === '/email/reset-password' ||
		pathname === '/dashboard/account/logout' ||
		isSensitiveSettingsAction ||
		isSensitiveOAuthOrPasskeyRoute;

	const shouldLog =
		!isStaticAssetPath(pathname) &&
		!isHighFrequencyPollRoute &&
		(isApiRequest || isDashboardRoute || isMaintenanceRoute);
	const shouldCaptureBody =
		shouldLog && !['GET', 'HEAD', 'OPTIONS'].includes(method) && !isSensitiveBodyRoute;
	const shouldCaptureQuery = shouldLog && method === 'GET' && !isSensitiveQueryRoute;

	return { shouldLog, shouldCaptureBody, shouldCaptureQuery };
}

let permissionsCatalogSeedPromise: Promise<void> | null = null;
let appLogProcessReady = false;

function ensurePermissionsCatalogSeededOnce(): Promise<void> {
	if (building) return Promise.resolve();
	if (!permissionsCatalogSeedPromise) {
		permissionsCatalogSeedPromise = ensurePermissionsCatalogSeeded().catch((err) => {
			permissionsCatalogSeedPromise = null;
			console.warn('ensurePermissionsCatalogSeeded:', err);
		});
	}
	return permissionsCatalogSeedPromise;
}

export const handle: Handle = async ({ event, resolve }) => {
	// Sonde infra : réponse immédiate sans DB, session ni maintenance.
	if (!building && isHealthCheckPath(event.url.pathname)) {
		return applySecurityHeaders(
			new Response('OK', {
				status: 200,
				headers: {
					'content-type': 'text/plain',
					'cache-control': 'no-store'
				}
			})
		);
	}

	if (!building && !appLogProcessReady) {
		appLogProcessReady = true;
		logApp({
			level: 'info',
			source: 'system',
			message: 'Processus serveur prêt',
			meta: { node: process.version }
		});
	}

	await ensurePermissionsCatalogSeededOnce();

	const sessionToken = event.cookies.get(auth.sessionCookieName);

	if (!sessionToken) {
		event.locals.user = null;
		event.locals.session = null;
	} else {
		try {
			const { session, user } = await auth.validateSessionTokenWithRetry(sessionToken);

			if (session && user) {
				event.locals.user = user;
				event.locals.session = session;
			} else {
				// Session absente ou expirée : réponse explicite de la DB, cookie invalide.
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

	if (event.locals.user) {
		await attachPermissionsToLocals(event.locals);
	} else {
		event.locals.permissions = [];
	}

	const pathname = event.url.pathname;

	const deprecatedApiRedirect = resolveDeprecatedApiRedirect(pathname);
	if (deprecatedApiRedirect) {
		const target = deprecatedApiRedirect.startsWith('/')
			? new URL(deprecatedApiRedirect, event.url.origin)
			: deprecatedApiRedirect;
		return applySecurityHeaders(Response.redirect(target, 308));
	}

	if (event.locals.user && pathname.startsWith('/dashboard') && !isStaticAssetPath(pathname)) {
		touchUserLastSeen(event.locals.user.id);
	}

	// Mode maintenance global: autoriser uniquement les superadmins.
	// Exceptions: pages auth pour permettre la connexion/déconnexion.
	// Pas de requête DB pendant le prerender (build sans Postgres).
	if (!building) {
		try {
			const maintenanceEnabled = await getMaintenanceMode();
			if (maintenanceEnabled) {
				const path = event.url.pathname;
				const isAuthException =
					path === '/dashboard/account/login' ||
					path === '/dashboard/account/register' ||
					path === '/dashboard/account/forgot-password' ||
					path === '/dashboard/account/logout' ||
					isPublicSitePath(path);
				const isMaintenancePage = path === '/maintenance' || path.startsWith('/maintenance/');
				const isStaticAsset =
					path.startsWith('/_app/') ||
					path.startsWith('/_svelte/') ||
					path.endsWith('.css') ||
					path.endsWith('.js') ||
					path.endsWith('.woff2');
				const canBypassMaintenance =
					event.locals.permissions?.includes('maintenance.bypass') ?? false;

				if (isMaintenancePage && !canBypassMaintenance) {
					const response = await resolve(event);
					const headers = new Headers(response.headers);
					headers.set('retry-after', '600');
					headers.set('cache-control', 'no-store');
					return applySecurityHeaders(
						new Response(response.body, {
							status: 503,
							statusText: 'Service Unavailable',
							headers
						})
					);
				}

				if (
					!canBypassMaintenance &&
					!isAuthException &&
					!isMaintenancePage &&
					!isStaticAsset &&
					!isHealthCheckPath(path)
				) {
					const acceptsHtml = event.request.headers.get('accept')?.includes('text/html');
					if (acceptsHtml) {
						const maintenanceUrl = new URL('/maintenance', event.url.origin);
						return applySecurityHeaders(Response.redirect(maintenanceUrl, 307));
					}
					return applySecurityHeaders(
						new Response(JSON.stringify({ error: 'Service en maintenance' }), {
							status: 503,
							headers: { 'content-type': 'application/json; charset=utf-8', 'retry-after': '600' }
						})
					);
				}
			} else {
				const path = event.url.pathname;
				if (path === '/maintenance' || path.startsWith('/maintenance/')) {
					const dest = event.locals.user ? '/dashboard' : '/';
					return applySecurityHeaders(Response.redirect(new URL(dest, event.url.origin), 302));
				}
			}
		} catch (error) {
			console.warn('Maintenance check skipped:', error);
		}
	}

	const method = event.request.method.toUpperCase();

	const isApiPath = pathname === '/api' || pathname.startsWith('/api/');
	const isSessionQuotaMeteredApiPath =
		pathname.startsWith('/api/extension-api') || pathname.startsWith('/api/extension');
	const apiKeyExemptPath =
		pathname.startsWith('/api/cron/') ||
		pathname.startsWith('/api/passkeys/') ||
		pathname.startsWith('/api/google-oauth/') ||
		pathname.startsWith('/api/discord-oauth/') ||
		// Échange du code de liaison : aucune clé encore, le code fait foi.
		pathname === '/api/extension/link';

	// Routes /api/* : clé API obligatoire (Authorization: Bearer … / X-Api-Key).
	if (
		isApiPath &&
		method !== 'OPTIONS' &&
		method !== 'HEAD' &&
		!apiKeyExemptPath &&
		isSessionQuotaMeteredApiPath
	) {
		const wantsApiKey = extractApiKeyFromRequest(event.request) !== null;
		if (wantsApiKey) {
			const keyResult = await validateApiKeyRequest(event.request);
			if (!keyResult.ok) {
				return applySecurityHeaders(
					jsonApiKeyGuardResponse(keyResult.failure, apiPublicErrorCorsHeaders)
				);
			}
			if (!isPathAllowedForApiKeyScope(keyResult.routeScope, pathname)) {
				return applySecurityHeaders(
					new Response(
						JSON.stringify({
							error: `Cette clé API est restreinte aux routes de l’extension (${keyResult.routeScope}).`
						}),
						{
							status: 403,
							headers: {
								'content-type': 'application/json; charset=utf-8',
								...apiPublicErrorCorsHeaders
							}
						}
					)
				);
			}
			// Garde supplémentaire : une clé d’extension ne s’utilise que depuis l’extension.
			if (
				apiKeyIsExtensionScoped(keyResult.routeScope) &&
				!isExtensionOriginAllowed(event.request)
			) {
				return applySecurityHeaders(
					new Response(JSON.stringify({ error: 'Origine non autorisée pour cette clé.' }), {
						status: 403,
						headers: {
							'content-type': 'application/json; charset=utf-8',
							...apiPublicErrorCorsHeaders
						}
					})
				);
			}
			const userRow = await getUserForApiKeyOwner(keyResult.ownerUserId);
			if (!userRow) {
				return applySecurityHeaders(jsonApiKeyGuardResponse('invalid', apiPublicErrorCorsHeaders));
			}
			event.locals.user = userRow;
			event.locals.authenticatedViaApiKey = true;
			event.locals.apiKeyRouteScope = keyResult.routeScope;
		} else {
			return applySecurityHeaders(jsonApiKeyGuardResponse('missing', apiPublicErrorCorsHeaders));
		}
	}

	let capturedBody: string | null = null;

	const { shouldLog, shouldCaptureBody, shouldCaptureQuery } = getRequestLoggingDecision(
		pathname,
		method,
		event.url
	);

	if (shouldCaptureBody) {
		try {
			const clone = event.request.clone();
			const bodyText = await clone.text();
			const trimmed = bodyText.trim();
			if (trimmed.length > 0) {
				capturedBody = trimmed;
			}
		} catch (error) {
			console.error('Impossible de lire le corps de la requête pour les logs:', error);
		}
	} else if (shouldCaptureQuery) {
		capturedBody = requestQueryForLog(event.url);
	}

	const response = await resolve(event);

	if (shouldLog) {
		const route = requestRouteLabel(event.url);

		// Logger l'action API
		logApiAction({
			method,
			route,
			status: response.status,
			userId: event.locals.user?.id ?? null,
			ipAddress: getRequestClientAddressOrUnknown(event),
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

	return applySecurityHeaders(response);
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

	const { shouldLog } = getRequestLoggingDecision(pathname, method, event.url);

	if (shouldLog && status >= 500) {
		const route = requestRouteLabel(event.url);

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
			ipAddress: getRequestClientAddressOrUnknown(event),
			payload: null,
			errorMessage
		});
	}

	return {
		message,
		status
	};
};
