/** Préfixes d’`Origin` des contextes d’extension (service worker, popup). */
const EXTENSION_ORIGIN_PREFIXES = [
	'chrome-extension://',
	'moz-extension://',
	'safari-web-extension://'
] as const;

/**
 * Garde supplémentaire pour les routes d’extension : si la requête porte une
 * `Origin` de navigateur, elle doit provenir d’une extension. Les requêtes sans
 * `Origin` (clients hors navigateur) passent — le token bearer reste
 * l’authentification principale.
 */
export function isExtensionOriginAllowed(request: Request): boolean {
	const origin = request.headers.get('origin')?.trim();
	if (!origin) return true;
	return EXTENSION_ORIGIN_PREFIXES.some((prefix) => origin.startsWith(prefix));
}
