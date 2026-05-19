import { getUserById } from '$lib/server/auth';
import type { User } from '$lib/server/db/schema';
import { DEV_IMPERSONATION_ORIGIN_COOKIE } from '$lib/server/dev-impersonation';

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

const EXTENSION_USER_AGENT_HINTS = ['f95-france-extension', 'f95france-extension'] as const;

function hasExtensionUserAgent(request: Request): boolean {
	const userAgent = request.headers.get('user-agent')?.toLowerCase().trim() ?? '';
	if (!userAgent) return false;
	return EXTENSION_USER_AGENT_HINTS.some((hint) => userAgent.includes(hint));
}

function isAllowedExtensionOrigin(origin: string): boolean {
	return (
		EXTENSION_ORIGIN_PREFIXES.some((prefix) => origin.startsWith(prefix)) ||
		EXTENSION_HOST_PAGE_ORIGIN_PREFIXES.some((prefix) => origin.startsWith(prefix))
	);
}

/**
 * Requête émise par l’extension (UA dédié). L’`Origin` peut être `chrome-extension://…`
 * (background) ou celle du forum (content script) — pas celle du dashboard.
 */
export function isExtensionClientRequest(request: Request): boolean {
	if (!hasExtensionUserAgent(request)) return false;

	const origin = request.headers.get('origin')?.trim() ?? '';
	// Service worker / certains contextes n’envoient pas d’Origin.
	if (!origin) return true;

	return isAllowedExtensionOrigin(origin);
}

/**
 * Identité pour le contournement superadmin sur `/api/extension-api`.
 * - Impersonation dev : le superadmin d’origine (cookie), pas le compte affiché.
 * - Clé API : propriétaire de la clé (évite de mélanger avec la session cookie du dashboard).
 * - Sinon : utilisateur de session.
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
		if (originUser?.role === 'superadmin') return originUser;
	}

	if (locals.authenticatedViaApiKey) {
		return locals.user;
	}

	return locals.user;
}

/**
 * Accès à `/api/extension-api` : client extension (UA + origine extension ou forum),
 * ou superadmin effectif (voir `resolveUserForExtensionApiOriginGate`).
 */
export function isExtensionApiCallerAllowed(request: Request, user: User | null): boolean {
	if (user?.role === 'superadmin') return true;
	return isExtensionClientRequest(request);
}
