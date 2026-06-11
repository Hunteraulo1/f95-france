import type { RequestEvent } from '@sveltejs/kit';

type ClientAddressEvent = Pick<RequestEvent, 'getClientAddress' | 'request'>;

/** IPv4 / IPv6 locales ou réseaux privés (proxy Docker Coolify, sonde, etc.). */
function isPrivateOrLocalIp(ip: string): boolean {
	const normalized = ip.replace(/^\[|\]$/g, '').split('%')[0] ?? ip;
	if (normalized === '::1' || normalized === '127.0.0.1' || normalized === 'localhost') {
		return true;
	}
	if (
		normalized.startsWith('10.') ||
		normalized.startsWith('192.168.') ||
		normalized.startsWith('fc')
	) {
		return true;
	}
	if (/^172\.(1[6-9]|2\d|3[01])\./.test(normalized)) {
		return true;
	}
	if (normalized.startsWith('fe80:')) {
		return true;
	}
	// IPv4-mappé en IPv6 (::ffff:10.x.x.x)
	if (/^::ffff:(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(normalized)) {
		return true;
	}
	return false;
}

function headerValue(headers: Headers, name: string): string | undefined {
	const value = headers.get(name)?.trim();
	return value && value.length > 0 ? value : undefined;
}

function firstPublicIpInForwardedList(value: string): string | undefined {
	const parts = value
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
	return parts.find((part) => !isPrivateOrLocalIp(part));
}

/**
 * IP client : Cloudflare → Traefik → app.
 * Priorité : CF-Connecting-IP, puis 1ʳᵉ IP publique de X-Forwarded-For, puis X-Real-IP public.
 * Ne jamais renvoyer 10.0.x.x si une IP publique est disponible dans les en-têtes.
 */
export function getRequestClientAddress(event: ClientAddressEvent): string | undefined {
	const headers = event.request.headers;

	// Cloudflare (si Traefik transmet l’en-tête jusqu’au conteneur)
	const cfConnecting = headerValue(headers, 'cf-connecting-ip');
	if (cfConnecting && !isPrivateOrLocalIp(cfConnecting)) {
		return cfConnecting;
	}

	const xff = headerValue(headers, 'x-forwarded-for');
	if (xff) {
		const fromXff = firstPublicIpInForwardedList(xff);
		if (fromXff) return fromXff;
	}

	const realIp = headerValue(headers, 'x-real-ip');
	if (realIp && !isPrivateOrLocalIp(realIp)) {
		return realIp;
	}

	try {
		const fromKit = event.getClientAddress();
		if (fromKit && !isPrivateOrLocalIp(fromKit)) {
			return fromKit;
		}
	} catch {
		// Healthcheck local sans en-têtes proxy
	}

	return undefined;
}

/** Variante pour champs DB non nullables (logs API, throttle). */
export function getRequestClientAddressOrUnknown(event: ClientAddressEvent): string {
	return getRequestClientAddress(event) ?? 'unknown';
}
