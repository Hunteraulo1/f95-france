import { privateEnv } from '$lib/server/private-env';
import { SITE } from '$lib/site';
import type { RequestHandler } from './$types';

function encryptionLines(): string[] {
	const lines: string[] = [];

	const fingerprint = privateEnv('SECURITY_OPENPGP_FINGERPRINT')?.replace(/\s/g, '');
	if (fingerprint) {
		const value = fingerprint.toLowerCase().startsWith('openpgp4fpr:')
			? fingerprint
			: `openpgp4fpr:${fingerprint}`;
		lines.push(`Encryption: ${value}`);
	}

	const keyUrl = privateEnv('SECURITY_OPENPGP_KEY_URL')?.trim();
	if (keyUrl) {
		try {
			lines.push(`Encryption: ${new URL(keyUrl).href}`);
		} catch {
			/* URL invalide — ignorée */
		}
	}

	return lines;
}

/** RFC 9116 — security.txt (contact divulgation responsable). */
export const GET: RequestHandler = () => {
	const contact = privateEnv('SECURITY_CONTACT') || SITE.defaultSecurityContact;
	const canonical =
		privateEnv('SECURITY_TXT_CANONICAL') || `${SITE.defaultOrigin}/.well-known/security.txt`;
	const expires = new Date();
	expires.setFullYear(expires.getFullYear() + 1);

	const body = [
		`Contact: ${contact}`,
		...encryptionLines(),
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
