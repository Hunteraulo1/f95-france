import { env } from '$env/dynamic/public';
import { isRegistrationEnabled } from '$lib/server/registration-policy';
import { buildSitemapXml } from '$lib/sitemap';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const body = buildSitemapXml(env.PUBLIC_APP_ORIGIN, {
		registrationEnabled: isRegistrationEnabled()
	});

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
