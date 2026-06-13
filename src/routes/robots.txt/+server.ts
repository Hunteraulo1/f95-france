import { env } from '$env/dynamic/public';
import { isRegistrationEnabled } from '$lib/server/registration-policy';
import { absoluteUrl, siteOrigin } from '$lib/site';
import type { RequestHandler } from './$types';

/** robots.txt dynamique — origine et sitemap alignés sur PUBLIC_APP_ORIGIN. */
export const GET: RequestHandler = () => {
	const origin = siteOrigin(env.PUBLIC_APP_ORIGIN);
	const sitemapUrl = absoluteUrl('/sitemap.xml', origin);
	const registrationEnabled = isRegistrationEnabled();

	const lines = ['User-agent: *', 'Allow: /', 'Disallow: /dashboard/', 'Allow: /dashboard/account/login'];

	if (registrationEnabled) {
		lines.push('Allow: /dashboard/account/register');
	}

	lines.push(`Sitemap: ${sitemapUrl}`);

	return new Response(`${lines.join('\n')}\n`, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=86400'
		}
	});
};
