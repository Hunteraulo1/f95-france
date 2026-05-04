import type { User } from '$lib/server/db/schema';

/** Préfixes d’`Origin` émis par les extensions (hors navigateur, facilement falsifiable). */
const EXTENSION_ORIGIN_PREFIXES = [
	'chrome-extension://',
	'moz-extension://',
	'safari-web-extension://'
] as const;

/**
 * Accès à `/api/extension-api` : superadmin (session ou clé API), ou requête dont l’en-tête
 * `Origin` provient d’une extension navigateur (Chrome, Firefox, Safari Web Extension).
 */
export function isExtensionApiCallerAllowed(request: Request, user: User | null): boolean {
	if (user?.role === 'superadmin') return true;
	const origin = request.headers.get('origin')?.trim() ?? '';
	if (!origin) return false;
	return EXTENSION_ORIGIN_PREFIXES.some((prefix) => origin.startsWith(prefix));
}
