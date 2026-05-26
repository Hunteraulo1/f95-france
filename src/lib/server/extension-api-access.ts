import { EXTENSION_ONLY_API_ROUTE } from '$lib/server/api-keys';
import { getUserById } from '$lib/server/auth';
import type { User } from '$lib/server/db/schema';
import { DEV_IMPERSONATION_ORIGIN_COOKIE } from '$lib/server/dev-impersonation';
import { hasPermissionForUser } from '$lib/server/permissions';

/** Préfixes d’`Origin` émis par le runtime extension (service worker, popup). */
const EXTENSION_ORIGIN_PREFIXES = [
	'chrome-extension://',
	'moz-extension://',
	'safari-web-extension://'
] as const;

/** Origines des pages où le content script de l’extension s’exécute (Origin = page, pas extension). */
const EXTENSION_HOST_PAGE_ORIGIN_PREFIXES = [
	'https://f95zone.to',
	'http://f95zone.to',
	'https://www.f95zone.to',
	'https://lewdcorner.com',
	'http://lewdcorner.com',
	'https://www.lewdcorner.com'
] as const;

function isAllowedExtensionOrigin(origin: string): boolean {
	if (!origin) return false;
	return (
		EXTENSION_ORIGIN_PREFIXES.some((prefix) => origin.startsWith(prefix)) ||
		EXTENSION_HOST_PAGE_ORIGIN_PREFIXES.some((prefix) => origin.startsWith(prefix))
	);
}

/**
 * Requête émise depuis un contexte extension (origine extension ou forum autorisé).
 * Ne s’appuie pas sur le User-Agent (trivial à falsifier).
 */
export function isExtensionClientRequest(request: Request): boolean {
	const origin = request.headers.get('origin')?.trim() ?? '';
	return isAllowedExtensionOrigin(origin);
}

export type ExtensionApiGateContext = {
	authenticatedViaApiKey?: boolean;
	apiKeyRouteScope?: string | null;
};

/**
 * Identité pour le contournement superadmin sur `/api/extension-api`.
 */
export async function resolveUserForExtensionApiOriginGate(
	locals: {
		user: User | null;
		session: { userId: string } | null;
		authenticatedViaApiKey?: boolean;
	},
	cookies?: { get: (name: string) => string | undefined }
): Promise<User | null> {
	const devOriginUserId = cookies?.get(DEV_IMPERSONATION_ORIGIN_COOKIE)?.trim();
	if (devOriginUserId) {
		const originUser = await getUserById(devOriginUserId);
		if (originUser && (await hasPermissionForUser(originUser, 'dev.impersonate'))) {
			return originUser;
		}
	}

	if (locals.authenticatedViaApiKey) {
		return locals.user;
	}

	return locals.user;
}

/**
 * Accès à `/api/extension-api` :
 * - superadmin effectif ;
 * - clé API restreinte à cette route ;
 * - session avec origine extension / forum autorisée.
 */
export function isExtensionApiCallerAllowed(
	request: Request,
	user: User | null,
	ctx?: ExtensionApiGateContext
): boolean {
	if (user?.role === 'superadmin') return true;

	if (ctx?.authenticatedViaApiKey && ctx.apiKeyRouteScope === EXTENSION_ONLY_API_ROUTE) {
		return true;
	}

	return isExtensionClientRequest(request);
}
