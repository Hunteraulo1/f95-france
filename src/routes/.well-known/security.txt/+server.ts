import { privateEnv } from '$lib/server/private-env';
import { SITE } from '$lib/site';
import type { RequestHandler } from './$types';

/** RFC 9116 — security.txt (contact divulgation responsable). */
export const GET: RequestHandler = () => {
	const contact = privateEnv('SECURITY_CONTACT') || SITE.defaultSecurityContact;
	const canonical =
		privateEnv('SECURITY_TXT_CANONICAL') || `${SITE.defaultOrigin}/.well-known/security.txt`;
	const expires = new Date();
	expires.setFullYear(expires.getFullYear() + 1);

	const body = [
		`Contact: ${contact}`,
		`Expires: ${expires.toISOString().replace('.000Z', 'Z')}`,
		`Canonical: ${canonical}`,
		'Preferred-Languages: fr'
	].join('\n');

	return new Response(`${body}\n`, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
			'Cache-Control': 'public, max-age=86400'
		}
	});
};
