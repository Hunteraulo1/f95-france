import { isSecureRequest } from '$lib/server/request-secure';
import type { RequestEvent } from '@sveltejs/kit';

type CookieExtras = {
	maxAge?: number;
	sameSite?: 'lax' | 'strict' | 'none';
	httpOnly?: boolean;
	path?: string;
};

/** Options par défaut pour cookies de session / OAuth (httpOnly, SameSite=Lax, Secure en prod). */
export function secureSessionCookieOptions(
	event: Pick<RequestEvent, 'url' | 'request'>,
	extras: CookieExtras = {}
) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: isSecureRequest(event),
		...extras
	};
}
