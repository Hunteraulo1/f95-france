import { privateEnv } from '$lib/server/private-env';
import { isRegistrationEnabled } from '$lib/server/registration-policy';
import { absoluteUrl, siteOrigin } from '$lib/site';
import type { RequestHandler } from './$types';

/** robots.txt dynamique — origine et sitemap alignés sur SERVICE_URL_APP. */
export const GET: RequestHandler = () => {
	const origin = siteOrigin(privateEnv('SERVICE_URL_APP'));
	const sitemapUrl = absoluteUrl('/sitemap.xml', origin);
	const registrationEnabled = isRegistrationEnabled();

	const lines = [
		'User-agent: *',
		'Allow: /',
		'Disallow: /dashboard/',
		'Allow: /dashboard/account/login'
	];

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
