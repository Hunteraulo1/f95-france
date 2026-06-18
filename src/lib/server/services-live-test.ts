import { getEffectiveConfig } from '$lib/server/app-config';
import { cronAuthFailureMessage, verifyCronAuth } from '$lib/server/cron-auth';
import { getDiscordOAuthConfig, isDiscordOAuthConfigured } from '$lib/server/discord-oauth';
import { getValidAccessToken } from '$lib/server/google-oauth';
import { isSmtpConfigured, verifySmtpConnection } from '$lib/server/mail';
import { privateEnv } from '$lib/server/private-env';
import {
	buildSecurityTxtContent,
	getSecurityTxtPublicUrl,
	parseSecurityTxt,
	validateSecurityTxt
} from '$lib/server/security-txt';
import { isLibreTranslateConfigured } from '$lib/server/translate-libretranslate';
import { isTurnstileConfigured } from '$lib/server/turnstile';

export type LiveServiceTestResult = {
	id: string;
	name: string;
	success: boolean;
	skipped: boolean;
	message: string;
	detail?: string;
	durationMs: number;
};

export type AllServicesTestReport = {
	success: boolean;
	testedAt: string;
	results: LiveServiceTestResult[];
};

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; durationMs: number }> {
	const started = Date.now();
	const value = await fn();
	return { value, durationMs: Date.now() - started };
}

function result(
	id: string,
	name: string,
	opts: {
		success: boolean;
		skipped?: boolean;
		message: string;
		detail?: string;
		durationMs?: number;
	}
): LiveServiceTestResult {
	return {
		id,
		name,
		success: opts.success,
		skipped: opts.skipped ?? false,
		message: opts.message,
		detail: opts.detail,
		durationMs: opts.durationMs ?? 0
	};
}

async function testGoogleSpreadsheet(): Promise<LiveServiceTestResult> {
	const cfg = await getEffectiveConfig();
	const spreadsheetId = cfg?.googleSpreadsheetId?.trim();

	if (!spreadsheetId) {
		return result('google', 'Google Sheets', {
			success: false,
			skipped: true,
			message: 'Ignoré — ID spreadsheet absent'
		});
	}

	try {
		const { value: data, durationMs } = await timed(async () => {
			const apiKey = cfg?.googleApiKey;
			const oauthToken = await getValidAccessToken();

			let apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title`;
			const headers: HeadersInit = { Accept: 'application/json' };

			if (oauthToken) {
				headers['Authorization'] = `Bearer ${oauthToken}`;
			} else if (apiKey) {
				apiUrl += `&key=${encodeURIComponent(apiKey)}`;
			} else {
				throw new Error('Authentification Google manquante (OAuth ou GOOGLE_API_KEY).');
			}

			const response = await fetch(apiUrl, {
				method: 'GET',
				headers,
				signal: AbortSignal.timeout(20_000)
			});

			if (!response.ok) {
				let detail = `HTTP ${response.status}`;
				try {
					const err = (await response.json()) as { error?: { message?: string } };
					if (err.error?.message) detail = err.error.message;
				} catch {
					/* ignore */
				}
				throw new Error(detail);
			}

			return (await response.json()) as { properties?: { title?: string } };
		});

		const title = data.properties?.title?.trim();
		return result('google', 'Google Sheets', {
			success: true,
			message: title ? `Connexion OK — ${title}` : 'Connexion OK',
			durationMs
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : 'Erreur inconnue';
		return result('google', 'Google Sheets', {
			success: false,
			message: 'Échec de connexion',
			detail: msg
		});
	}
}

async function testSmtp(): Promise<LiveServiceTestResult> {
	if (!isSmtpConfigured()) {
		return result('mail', 'Mail (SMTP)', {
			success: false,
			skipped: true,
			message: 'Ignoré — SMTP non configuré'
		});
	}

	const skip = privateEnv('EMAIL_VERIFICATION_SKIP')?.trim().toLowerCase();
	if (skip === 'true' || skip === '1') {
		return result('mail', 'Mail (SMTP)', {
			success: true,
			skipped: true,
			message: 'Ignoré — EMAIL_VERIFICATION_SKIP actif (pas d’envoi réel)'
		});
	}

	try {
		const { durationMs } = await timed(() => verifySmtpConnection());
		return result('mail', 'Mail (SMTP)', {
			success: true,
			message: 'Connexion SMTP vérifiée',
			durationMs
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : 'Erreur inconnue';
		return result('mail', 'Mail (SMTP)', {
			success: false,
			message: 'Échec SMTP',
			detail: msg
		});
	}
}

async function testLibreTranslate(): Promise<LiveServiceTestResult> {
	if (!isLibreTranslateConfigured()) {
		return result('libretranslate', 'LibreTranslate', {
			success: false,
			skipped: true,
			message: 'Ignoré — LIBRETRANSLATE_URL absent'
		});
	}

	const raw = privateEnv('LIBRETRANSLATE_URL')?.trim() ?? '';
	const baseUrl = raw.replace(/\/+$/, '').replace(/\/translate$/i, '');

	try {
		const { durationMs } = await timed(async () => {
			const res = await fetch(`${baseUrl}/languages`, {
				method: 'GET',
				signal: AbortSignal.timeout(15_000)
			});
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}`);
			}
			const json = await res.json();
			if (!Array.isArray(json)) {
				throw new Error('Réponse /languages invalide');
			}
		});

		return result('libretranslate', 'LibreTranslate', {
			success: true,
			message: 'API joignable',
			durationMs
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : 'Erreur inconnue';
		return result('libretranslate', 'LibreTranslate', {
			success: false,
			message: 'API injoignable',
			detail: msg
		});
	}
}

function testCronAuth(): LiveServiceTestResult {
	const secret = privateEnv('SERVICE_PASSWORD_64_CRON-SECRET');
	if (!secret) {
		return result('cron', 'Cron (SERVICE_PASSWORD_64_CRON-SECRET)', {
			success: false,
			skipped: true,
			message: 'Ignoré — SERVICE_PASSWORD_64_CRON-SECRET absent'
		});
	}

	const request = new Request('http://internal/api/cron/check-version', {
		headers: { Authorization: `Bearer ${secret}` }
	});
	const auth = verifyCronAuth(request);

	if (auth.ok) {
		return result('cron', 'Cron (SERVICE_PASSWORD_64_CRON-SECRET)', {
			success: true,
			message: 'SERVICE_PASSWORD_64_CRON-SECRET valide (auth simulée)'
		});
	}

	return result('cron', 'Cron (SERVICE_PASSWORD_64_CRON-SECRET)', {
		success: false,
		message: 'Auth cron invalide',
		detail: cronAuthFailureMessage(auth.reason)
	});
}

function discordWebhookProbeUrl(url: string): string | null {
	try {
		const parsed = new URL(url.trim());
		if (!/^\/api\/webhooks\/\d+\/[^/]+/.test(parsed.pathname)) {
			return null;
		}
		parsed.search = '';
		parsed.hash = '';
		return parsed.toString().replace(/\/$/, '');
	} catch {
		return null;
	}
}

async function testDiscordWebhook(
	id: string,
	name: string,
	url: string | null | undefined
): Promise<LiveServiceTestResult> {
	const trimmed = url?.trim();
	if (!trimmed) {
		return result(id, name, {
			success: false,
			skipped: true,
			message: 'Ignoré — webhook non configuré'
		});
	}

	const probeUrl = discordWebhookProbeUrl(trimmed);
	if (!probeUrl) {
		return result(id, name, {
			success: false,
			message: 'URL webhook invalide',
			detail: 'Format attendu : https://discord.com/api/webhooks/{id}/{token}'
		});
	}

	try {
		const { durationMs } = await timed(async () => {
			// GET /webhooks/{id}/{token} — lit les métadonnées sans envoyer de message.
			const res = await fetch(probeUrl, {
				method: 'GET',
				headers: { Accept: 'application/json' },
				signal: AbortSignal.timeout(15_000)
			});

			if (!res.ok) {
				const body = await res.text().catch(() => '');
				throw new Error(`Discord HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ''}`);
			}

			const data = (await res.json().catch(() => null)) as { id?: string } | null;
			if (!data?.id) {
				throw new Error('Réponse Discord inattendue');
			}
		});

		return result(id, name, {
			success: true,
			message: 'Webhook valide (sans envoi)',
			durationMs
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : 'Erreur inconnue';
		return result(id, name, {
			success: false,
			message: 'Échec webhook',
			detail: msg
		});
	}
}

async function testDiscordOAuth(): Promise<LiveServiceTestResult> {
	if (!isDiscordOAuthConfigured()) {
		return result('discord-oauth', 'Discord OAuth', {
			success: false,
			skipped: true,
			message: 'Ignoré — identifiants absents'
		});
	}

	const { clientId, clientSecret } = getDiscordOAuthConfig();

	try {
		const { durationMs } = await timed(async () => {
			// Code volontairement invalide : invalid_grant = identifiants acceptés ; invalid_client = secret/id incorrect.
			const body = new URLSearchParams({
				client_id: clientId,
				client_secret: clientSecret,
				grant_type: 'authorization_code',
				code: 'f95-france-oauth-config-test',
				redirect_uri: 'https://discord.com/api/oauth2/authorize'
			});

			const res = await fetch('https://discord.com/api/oauth2/token', {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body,
				signal: AbortSignal.timeout(15_000)
			});

			const json = (await res.json().catch(() => null)) as {
				error?: string;
				error_description?: string;
			} | null;
			const errorCode = json?.error ?? '';

			if (errorCode === 'invalid_client') {
				throw new Error('Client ID ou secret Discord invalide');
			}

			if (errorCode === 'invalid_grant' || errorCode === 'invalid_request') {
				return;
			}

			if (!res.ok) {
				const detail = json?.error_description ?? errorCode ?? `HTTP ${res.status}`;
				throw new Error(detail);
			}
		});

		return result('discord-oauth', 'Discord OAuth', {
			success: true,
			message: 'Identifiants Discord valides',
			durationMs
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : 'Erreur inconnue';
		return result('discord-oauth', 'Discord OAuth', {
			success: false,
			message: 'Échec OAuth Discord',
			detail: msg
		});
	}
}

async function testTurnstile(): Promise<LiveServiceTestResult> {
	const name = 'Turnstile';

	if (!isTurnstileConfigured()) {
		return result('turnstile', name, {
			success: false,
			skipped: true,
			message: 'Ignoré — clés Turnstile absentes'
		});
	}

	const secretKey = privateEnv('TURNSTILE_SECRET_KEY')?.trim() ?? '';

	try {
		const { durationMs } = await timed(async () => {
			// Jeton volontairement invalide : invalid-input-response = secret accepté ; invalid-input-secret = secret incorrect.
			const body = new URLSearchParams({
				secret: secretKey,
				response: 'f95-france-turnstile-config-test'
			});

			const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body,
				signal: AbortSignal.timeout(15_000)
			});

			if (!res.ok) {
				throw new Error(`HTTP ${res.status}`);
			}

			const data = (await res.json()) as {
				success?: boolean;
				'error-codes'?: string[];
			};
			const errorCodes = data['error-codes'] ?? [];

			if (errorCodes.includes('invalid-input-secret')) {
				throw new Error('TURNSTILE_SECRET_KEY invalide');
			}

			if (errorCodes.includes('invalid-input-response')) {
				return;
			}

			if (data.success === true) {
				return;
			}

			throw new Error(errorCodes.join(', ') || 'Réponse siteverify inattendue');
		});

		return result('turnstile', name, {
			success: true,
			message: 'API siteverify joignable (secret valide)',
			durationMs
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : 'Erreur inconnue';
		return result('turnstile', name, {
			success: false,
			message: 'Échec Turnstile',
			detail: msg
		});
	}
}

async function testSecurityTxt(): Promise<LiveServiceTestResult> {
	const name = 'Sécurité (RFC 9116)';

	const localErrors = validateSecurityTxt(parseSecurityTxt(buildSecurityTxtContent()));
	if (localErrors.length > 0) {
		return result('security-txt', name, {
			success: false,
			message: 'security.txt invalide',
			detail: localErrors.join(' ; ')
		});
	}

	const publicUrl = getSecurityTxtPublicUrl();
	if (!publicUrl) {
		return result('security-txt', name, {
			success: true,
			message: 'Contenu local valide (URL publique non testée)'
		});
	}

	try {
		const { durationMs } = await timed(async () => {
			const res = await fetch(publicUrl, {
				method: 'GET',
				headers: { Accept: 'text/plain' },
				signal: AbortSignal.timeout(15_000)
			});

			if (!res.ok) {
				throw new Error(`HTTP ${res.status} — ${publicUrl}`);
			}

			const errors = validateSecurityTxt(parseSecurityTxt(await res.text()));
			if (errors.length > 0) {
				throw new Error(errors.join(' ; '));
			}
		});

		return result('security-txt', name, {
			success: true,
			message: 'security.txt accessible et valide',
			durationMs
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : 'Erreur inconnue';
		return result('security-txt', name, {
			success: false,
			message: 'Échec security.txt public',
			detail: msg
		});
	}
}

/** Lance des tests de connectivité / auth réels sur les services configurés. */
export async function runAllServicesLiveTests(): Promise<AllServicesTestReport> {
	const cfg = await getEffectiveConfig();

	const results = await Promise.all([
		testGoogleSpreadsheet(),
		testSmtp(),
		testLibreTranslate(),
		Promise.resolve(testCronAuth()),
		testSecurityTxt(),
		testDiscordOAuth(),
		testDiscordWebhook('discord-updates', 'Discord — Mises à jour', cfg?.discordWebhookUpdates),
		testDiscordWebhook(
			'discord-translators',
			'Discord — Traducteurs',
			cfg?.discordWebhookTranslators
		),
		testDiscordWebhook('discord-admin', 'Discord — Admin', cfg?.discordWebhookAdmin),
		testTurnstile()
	]);

	const success = results.every((r) => r.success || r.skipped);

	return {
		success,
		testedAt: new Date().toISOString(),
		results
	};
}
