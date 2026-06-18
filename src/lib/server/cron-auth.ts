import { privateEnv } from '$lib/server/private-env';
import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';

export type CronAuthFailureReason =
	| 'missing_server_secret'
	| 'missing_client_token'
	| 'invalid_token';

export type CronAuthResult = { ok: true } | { ok: false; reason: CronAuthFailureReason };

function safeCompareToken(a: string, b: string): boolean {
	const bufA = Buffer.from(a, 'utf8');
	const bufB = Buffer.from(b, 'utf8');
	return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function extractCronToken(request: Request): string {
	const authHeader = request.headers.get('authorization')?.trim() ?? '';
	if (authHeader) {
		if (authHeader.toLowerCase().startsWith('bearer ')) {
			return authHeader.slice(7).trim();
		}
		return authHeader;
	}

	const cronSecretHeader =
		request.headers.get('x-cron-secret')?.trim() ??
		request.headers.get('x-cron-token')?.trim() ??
		'';
	if (cronSecretHeader) return cronSecretHeader;

	return '';
}

/** Vérifie l’auth des routes `/api/cron/*` (Bearer, en-tête brut ou `X-Cron-Secret`). */
export function verifyCronAuth(request: Request): CronAuthResult {
	const secret = privateEnv('SERVICE_PASSWORD_64_CRON-SECRET');
	if (!secret) {
		return { ok: false, reason: 'missing_server_secret' };
	}

	const token = extractCronToken(request);
	if (!token) {
		return { ok: false, reason: 'missing_client_token' };
	}

	if (!safeCompareToken(token, secret)) {
		return { ok: false, reason: 'invalid_token' };
	}

	return { ok: true };
}

export function cronAuthFailureMessage(reason: CronAuthFailureReason): string {
	switch (reason) {
		case 'missing_server_secret':
			return 'SERVICE_PASSWORD_64_CRON-SECRET non configuré sur le serveur';
		case 'missing_client_token':
			return 'Jeton manquant (Authorization: Bearer … ou en-tête X-Cron-Secret)';
		case 'invalid_token':
			return 'Jeton cron invalide';
	}
}
