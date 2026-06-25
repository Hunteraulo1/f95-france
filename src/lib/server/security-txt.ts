import { privateEnv } from '$lib/server/private-env';
import { SITE, siteOrigin } from '$lib/site';

export type ParsedSecurityTxt = {
	contacts: string[];
	expires: Date | null;
	canonical: string[];
	encryption: string[];
	preferredLanguages: string[];
};

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

/** Contenu security.txt tel que servi par `/.well-known/security.txt`. */
export function buildSecurityTxtContent(): string {
	const contact = privateEnv('SECURITY_CONTACT') || SITE.defaultSecurityContact;
	const canonical =
		privateEnv('SECURITY_TXT_CANONICAL') ||
		`${siteOrigin(privateEnv('SERVICE_URL_APP'))}/.well-known/security.txt`;
	const expires = new Date();
	expires.setFullYear(expires.getFullYear() + 1);

	const body = [
		`Contact: ${contact}`,
		...encryptionLines(),
		`Expires: ${expires.toISOString().replace('.000Z', 'Z')}`,
		`Canonical: ${canonical}`,
		'Preferred-Languages: fr'
	].join('\n');

	return `${body}\n`;
}

export function extractPlainSecurityTxt(raw: string): string {
	if (!raw.includes('-----BEGIN PGP SIGNED MESSAGE-----')) {
		return raw;
	}

	const match = raw.match(
		/-----BEGIN PGP SIGNED MESSAGE-----\r?\n(?:Hash:[^\r\n]*\r?\n\r?\n)?([\s\S]*?)\r?\n-----BEGIN PGP SIGNATURE-----/
	);
	return match?.[1]?.trim() ?? raw;
}

export function parseSecurityTxt(raw: string): ParsedSecurityTxt {
	const parsed: ParsedSecurityTxt = {
		contacts: [],
		expires: null,
		canonical: [],
		encryption: [],
		preferredLanguages: []
	};

	for (const line of extractPlainSecurityTxt(raw).split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;

		const sep = trimmed.indexOf(':');
		if (sep === -1) continue;

		const key = trimmed.slice(0, sep).trim().toLowerCase();
		const value = trimmed.slice(sep + 1).trim();
		if (!value) continue;

		switch (key) {
			case 'contact':
				parsed.contacts.push(value);
				break;
			case 'expires': {
				const date = new Date(value);
				if (!Number.isNaN(date.getTime())) parsed.expires = date;
				break;
			}
			case 'canonical':
				parsed.canonical.push(value);
				break;
			case 'encryption':
				parsed.encryption.push(value);
				break;
			case 'preferred-languages':
				parsed.preferredLanguages.push(value);
				break;
		}
	}

	return parsed;
}

function isValidContact(value: string): boolean {
	return value.startsWith('mailto:') || value.startsWith('https://') || value.startsWith('tel:');
}

/** Erreurs RFC 9116 (champs obligatoires et Expires futur). */
export function validateSecurityTxt(parsed: ParsedSecurityTxt, now = new Date()): string[] {
	const errors: string[] = [];

	if (parsed.contacts.length === 0) {
		errors.push('Contact manquant');
	} else if (!parsed.contacts.some(isValidContact)) {
		errors.push('Contact invalide (mailto:, https: ou tel: requis)');
	}

	if (!parsed.expires) {
		errors.push('Expires manquant ou invalide');
	} else if (parsed.expires <= now) {
		errors.push('Expires est dans le passé');
	}

	return errors;
}

export function getSecurityTxtPublicUrl(): string | null {
	const origin = privateEnv('SERVICE_URL_APP')?.trim();
	if (!origin) return null;
	try {
		return new URL('/.well-known/security.txt', origin).href;
	} catch {
		return null;
	}
}
