import { env } from '$env/dynamic/public';
import { getRequestClientAddress } from '$lib/server/client-address';
import { privateEnv } from '$lib/server/private-env';
import { TURNSTILE_FORM_FIELD } from '$lib/turnstile/constants';
import type { RequestEvent } from '@sveltejs/kit';

export { TURNSTILE_FORM_FIELD };

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const TURNSTILE_MISSING_MESSAGE = 'Veuillez valider le captcha.';
export const TURNSTILE_INVALID_MESSAGE = 'Captcha invalide ou expiré. Réessayez.';

type TurnstileVerifyResponse = {
	success?: boolean;
	'error-codes'?: string[];
};

export function isTurnstileConfigured(): boolean {
	const siteKey = env.PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
	const secretKey = privateEnv('TURNSTILE_SECRET_KEY')?.trim() ?? '';
	return siteKey.length > 0 && secretKey.length > 0;
}

/** Clé site publique pour le widget (vide si non configuré). */
export function getTurnstileSiteKey(): string {
	if (!isTurnstileConfigured()) return '';
	return env.PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
}

async function verifyTurnstileToken(
	token: string,
	remoteIp: string | undefined,
	secretKey: string
): Promise<boolean> {
	const body = new URLSearchParams({
		secret: secretKey,
		response: token
	});
	if (remoteIp) {
		body.set('remoteip', remoteIp);
	}

	const response = await fetch(SITEVERIFY_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body
	});

	if (!response.ok) {
		console.warn('[turnstile] siteverify HTTP', response.status);
		return false;
	}

	const data = (await response.json()) as TurnstileVerifyResponse;
	if (!data.success) {
		console.warn('[turnstile] siteverify refusé:', data['error-codes']?.join(', ') ?? 'unknown');
	}
	return data.success === true;
}

function turnstileRequiredInProduction(): boolean {
	return process.env.NODE_ENV === 'production';
}

/**
 * Vérifie le jeton Turnstile envoyé par le formulaire.
 * En dev sans clés : ignoré. En prod sans clés : refusé.
 */
export async function verifyTurnstileFromForm(
	event: RequestEvent,
	token: string | null | undefined
): Promise<{ ok: true } | { ok: false; message: string }> {
	if (!isTurnstileConfigured()) {
		if (turnstileRequiredInProduction()) {
			console.error(
				'[turnstile] PUBLIC_TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY manquants en production'
			);
			return { ok: false, message: 'Captcha indisponible. Contactez l’administrateur.' };
		}
		return { ok: true };
	}

	const trimmed = (token ?? '').trim();
	if (!trimmed) {
		return { ok: false, message: TURNSTILE_MISSING_MESSAGE };
	}

	const secretKey = privateEnv('TURNSTILE_SECRET_KEY')?.trim() ?? '';
	const valid = await verifyTurnstileToken(trimmed, getRequestClientAddress(event), secretKey);
	if (!valid) {
		return { ok: false, message: TURNSTILE_INVALID_MESSAGE };
	}

	return { ok: true };
}

export function extractTurnstileTokenFromFormData(formData: FormData): string | null {
	const raw = formData.get(TURNSTILE_FORM_FIELD);
	return typeof raw === 'string' ? raw : null;
}

export function extractTurnstileTokenFromJson(body: Record<string, unknown>): string | null {
	const raw = body[TURNSTILE_FORM_FIELD] ?? body.turnstileToken;
	return typeof raw === 'string' ? raw : null;
}
