/** Valeur HSTS : 2 ans, sous-domaines, éligible preload. */
const HSTS = 'max-age=63072000; includeSubDomains; preload';

const STATIC_SECURITY_HEADERS: Readonly<Record<string, string>> = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY'
};

function shouldSendHsts(): boolean {
	return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

/** Ajoute les en-têtes de sécurité HTTP (hors CSP, géré par `kit.csp` dans svelte.config.js). */
export function applySecurityHeaders(response: Response): Response {
	const headers = new Headers(response.headers);

	for (const [name, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
		if (!headers.has(name)) {
			headers.set(name, value);
		}
	}

	if (shouldSendHsts() && !headers.has('Strict-Transport-Security')) {
		headers.set('Strict-Transport-Security', HSTS);
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
