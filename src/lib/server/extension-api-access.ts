import { getUserById } from '$lib/server/auth';
import type { User } from '$lib/server/db/schema';

/** Préfixes d’`Origin` émis par les extensions (hors navigateur, facilement falsifiable). */
const EXTENSION_ORIGIN_PREFIXES = [
	'chrome-extension://',
	'moz-extension://',
	'safari-web-extension://'
] as const;

/**
 * Identité utilisée pour le contournement « superadmin » sur `/api/extension-api`.
 * Si une clé API est envoyée, les hooks mettent `locals.user` sur le **propriétaire de la clé**,
 * alors que la **session** peut encore être celle d’un autre compte (ex. impersonation dev).
 * On s’aligne alors sur l’utilisateur lié à la session pour le contrôle d’origine.
 */
export async function resolveUserForExtensionApiOriginGate(locals: {
	user: User | null;
	session: { userId: string } | null;
	authenticatedViaApiKey?: boolean;
}): Promise<User | null> {
	if (locals.authenticatedViaApiKey && locals.session?.userId) {
		return getUserById(locals.session.userId);
	}
	return locals.user;
}

/**
 * Accès à `/api/extension-api` : superadmin (`user` effectif, voir
 * `resolveUserForExtensionApiOriginGate`), ou `Origin` d’extension navigateur.
 */
export function isExtensionApiCallerAllowed(request: Request, user: User | null): boolean {
	if (user?.role === 'superadmin') return true;
	const origin = request.headers.get('origin')?.trim() ?? '';
	if (!origin) return false;
	return EXTENSION_ORIGIN_PREFIXES.some((prefix) => origin.startsWith(prefix));
}
