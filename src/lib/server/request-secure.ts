import type { RequestEvent } from '@sveltejs/kit';

/** Indique si les cookies sensibles doivent être émis avec l’attribut Secure. */
export function isSecureRequest(event: Pick<RequestEvent, 'url' | 'request'>): boolean {
	if (process.env.NODE_ENV === 'production') {
		return true;
	}
	const forwarded = event.request.headers
		.get('x-forwarded-proto')
		?.split(',')[0]
		?.trim()
		.toLowerCase();
	if (forwarded === 'https') {
		return true;
	}
	return event.url.protocol === 'https:';
}
