/** Valeur HSTS : 2 ans, sous-domaines, éligible preload. */
const HSTS = 'max-age=63072000; includeSubDomains; preload';

const STATIC_SECURITY_HEADERS: Readonly<Record<string, string>> = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy':
		'accelerometer=(self "https://www.youtube.com" "https://www.youtube-nocookie.com"), autoplay=(self "https://www.youtube.com" "https://www.youtube-nocookie.com"), camera=(), geolocation=(), gyroscope=(self "https://www.youtube.com" "https://www.youtube-nocookie.com"), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=(), encrypted-media=(self "https://www.youtube.com" "https://www.youtube-nocookie.com"), picture-in-picture=(self "https://www.youtube.com" "https://www.youtube-nocookie.com")',
	'Cross-Origin-Opener-Policy': 'same-origin',
	/** Isolation partielle (audit COEP) ; moins strict que require-corp pour les iframes tierces (YouTube). */
	'Cross-Origin-Embedder-Policy': 'credentialless',
	/** Protège les réponses de ce site ; n’empêche pas le chargement d’images tierces (F95, etc.). */
	'Cross-Origin-Resource-Policy': 'same-site'
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
