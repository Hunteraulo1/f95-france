import type { RequestHandler } from './$types';

/** Faute courante : `/robot.txt` → `/robots.txt` (RFC de fait pour les crawlers). */
export const GET: RequestHandler = () => {
	return new Response(null, {
		status: 301,
		headers: {
			Location: '/robots.txt',
			'Cache-Control': 'public, max-age=86400'
		}
	});
};
