import { env } from '$env/dynamic/private';
import { SITE } from '$lib/site';
import type { RequestHandler } from './$types';

/** RFC 9116 — security.txt (contact divulgation responsable). */
export const GET: RequestHandler = () => {
	const contact = env.SECURITY_CONTACT?.trim() || SITE.defaultSecurityContact;
	const canonical = env.SECURITY_TXT_CANONICAL?.trim() || `${SITE.defaultOrigin}/.well-known/security.txt`;
	const expires = new Date();
	expires.setFullYear(expires.getFullYear() + 1);

	const body = [
		`Contact: ${contact}`,
		`Expires: ${expires.toISOString()}`,
		'Preferred-Languages: fr, en',
		`Canonical: ${canonical}`
	].join('\n');

	return new Response(`${body}\n`, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=86400'
		}
	});
};
