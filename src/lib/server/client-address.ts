import type { RequestEvent } from '@sveltejs/kit';

/**
 * IP client pour logs / throttle / Turnstile.
 * Avec ADDRESS_HEADER (ex. x-forwarded-for derrière Coolify), les requêtes sans cet en-tête
 * (sonde /api/health en local) feraient planter getClientAddress() — on retombe sur undefined.
 */
export function getRequestClientAddress(
	event: Pick<RequestEvent, 'getClientAddress'>
): string | undefined {
	try {
		return event.getClientAddress();
	} catch {
		return undefined;
	}
}

/** Variante pour champs DB non nullables (logs API). */
export function getRequestClientAddressOrUnknown(
	event: Pick<RequestEvent, 'getClientAddress'>
): string {
	return getRequestClientAddress(event) ?? 'unknown';
}
