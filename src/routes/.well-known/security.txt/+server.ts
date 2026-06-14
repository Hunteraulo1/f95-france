import { buildSecurityTxtContent } from '$lib/server/security-txt';
import type { RequestHandler } from './$types';

/** RFC 9116 — security.txt (contact divulgation responsable). */
export const GET: RequestHandler = () => {
	return new Response(buildSecurityTxtContent(), {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'X-Content-Type-Options': 'nosniff',
			'Cache-Control': 'public, max-age=86400'
		}
	});
};
