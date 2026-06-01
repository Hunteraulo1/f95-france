import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase64url, encodeHexLowerCase } from '@oslojs/encoding';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_PREFIX = 'scrypt:v1:';
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

export const INVALID_CREDENTIALS_MESSAGE = 'Identifiant ou mot de passe incorrect.';

function hashSecretSha256(secret: string): string {
	return encodeHexLowerCase(sha256(new TextEncoder().encode(secret)));
}

/** Hash du secret de cookie de session (stocké en base). */
export function hashSessionSecret(secret: string): string {
	return hashSecretSha256(secret);
}

function timingSafeEqualHex(a: string, b: string): boolean {
	const bufA = Buffer.from(a, 'utf8');
	const bufB = Buffer.from(b, 'utf8');
	return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function verifySessionSecret(secret: string, storedHash: string): boolean {
	const computed = hashSecretSha256(secret);
	if (computed.length !== storedHash.length) return false;
	return timingSafeEqualHex(computed, storedHash);
}

function verifyLegacyPassword(password: string, hashedPassword: string): boolean {
	const [saltString, hashString] = hashedPassword.split(':');
	if (!saltString || !hashString) return false;

	const hash = sha256(new TextEncoder().encode(password + saltString));
	const hashStringFromPassword = encodeHexLowerCase(hash);

	if (hashStringFromPassword.length !== hashString.length) return false;
	return timingSafeEqualHex(hashStringFromPassword, hashString);
}

function scryptDerive(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scrypt(password, salt, keylen, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (err, derived) => {
			if (err) reject(err);
			else resolve(derived);
		});
	});
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const derived = await scryptDerive(password, salt, SCRYPT_KEYLEN);
	return `${SCRYPT_PREFIX}${encodeBase64url(new Uint8Array(salt))}:${encodeBase64url(new Uint8Array(derived))}`;
}

export type PasswordVerifyResult = {
	valid: boolean;
	/** Ancien format SHA-256 : rehash recommandé après succès. */
	needsRehash: boolean;
};

export async function verifyPassword(
	password: string,
	hashedPassword: string
): Promise<PasswordVerifyResult> {
	if (hashedPassword.startsWith(SCRYPT_PREFIX)) {
		const payload = hashedPassword.slice(SCRYPT_PREFIX.length);
		const colon = payload.indexOf(':');
		if (colon < 1) return { valid: false, needsRehash: false };

		const saltB64 = payload.slice(0, colon);
		const hashB64 = payload.slice(colon + 1);
		let salt: Uint8Array;
		let expected: Uint8Array;
		try {
			salt = new Uint8Array(Buffer.from(saltB64, 'base64url'));
			expected = new Uint8Array(Buffer.from(hashB64, 'base64url'));
		} catch {
			return { valid: false, needsRehash: false };
		}

		const derived = await scryptDerive(password, Buffer.from(salt), expected.length);
		if (derived.length !== expected.length) return { valid: false, needsRehash: false };

		return {
			valid: timingSafeEqual(derived, Buffer.from(expected)),
			needsRehash: false
		};
	}

	const valid = verifyLegacyPassword(password, hashedPassword);
	return { valid, needsRehash: valid };
}
