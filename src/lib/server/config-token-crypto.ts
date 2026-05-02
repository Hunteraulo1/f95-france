import { privateEnv } from '$lib/server/private-env';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';

function getKey(): Buffer | null {
	const b64 = privateEnv('CONFIG_TOKEN_ENCRYPTION_KEY');
	if (!b64) return null;
	const buf = Buffer.from(b64, 'base64');
	if (buf.length !== 32) {
		console.warn(
			'CONFIG_TOKEN_ENCRYPTION_KEY doit être une chaîne base64 de 32 octets (44 caractères typiques).'
		);
		return null;
	}
	return buf;
}

/** Chiffre un jeton OAuth avant stockage en base (AES-256-GCM). Sans clé : renvoie la valeur en clair. */
export function sealOAuthToken(plain: string | null | undefined): string | null {
	if (plain == null || plain === '') return null;
	const key = getKey();
	if (!key) return plain;

	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64url');
}

/** Déchiffre un jeton lu en base. Valeurs historiques non préfixées : renvoyées telles quelles. */
export function openOAuthToken(stored: string | null | undefined): string | null {
	if (stored == null || stored === '') return null;
	if (!stored.startsWith(PREFIX)) return stored;

	const key = getKey();
	if (!key) {
		console.warn('CONFIG_TOKEN_ENCRYPTION_KEY manquant : impossible de déchiffrer le jeton OAuth.');
		return null;
	}

	try {
		const raw = Buffer.from(stored.slice(PREFIX.length), 'base64url');
		const iv = raw.subarray(0, 12);
		const tag = raw.subarray(12, 28);
		const enc = raw.subarray(28);
		const decipher = createDecipheriv('aes-256-gcm', key, iv);
		decipher.setAuthTag(tag);
		return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
	} catch {
		return null;
	}
}
