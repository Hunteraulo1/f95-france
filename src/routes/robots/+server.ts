import { env } from '$env/dynamic/public';
import { absoluteUrl, siteOrigin } from '$lib/site';
import type { RequestHandler } from './$types';

/** robots.txt dynamique — origine et sitemap alignés sur PUBLIC_APP_ORIGIN. */
export const GET: RequestHandler = () => {
	const origin = siteOrigin(env.PUBLIC_APP_ORIGIN);
	const sitemapUrl = absoluteUrl('/sitemap.xml', origin);

	const body = [
		'User-agent: *',
		'Allow: /',
		'Disallow: /dashboard/',
		'Allow: /dashboard/login',
		'Allow: /dashboard/register',
		`Sitemap: ${sitemapUrl}`
	].join('\n');

	return new Response(`${body}\n`, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=86400'
		}
	});
};
