import { getEffectiveConfig } from '$lib/server/app-config';
import { getValidAccessToken } from '$lib/server/google-oauth';

const TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2';
const MAX_CHUNK_CHARS = 4500;

type TranslateAuth = { mode: 'oauth'; accessToken: string } | { mode: 'apiKey'; apiKey: string };

async function resolveTranslateAuthOptions(): Promise<TranslateAuth[]> {
	const options: TranslateAuth[] = [];

	const oauthToken = await getValidAccessToken();
	if (oauthToken) {
		options.push({ mode: 'oauth', accessToken: oauthToken });
	}

	const config = await getEffectiveConfig();
	const apiKey = config?.googleApiKey?.trim();
	if (apiKey) {
		options.push({ mode: 'apiKey', apiKey });
	}

	return options;
}

function isInsufficientScopeError(status: number, detail: string): boolean {
	return (
		status === 403 &&
		(detail.includes('insufficient authentication scopes') ||
			detail.includes('Insufficient Permission'))
	);
}

function isTranslationApiDisabledError(detail: string): boolean {
	return (
		detail.includes('SERVICE_DISABLED') ||
		detail.includes('accessNotConfigured') ||
		detail.includes('Cloud Translation API has not been used')
	);
}

function extractTranslationApiActivationUrl(detail: string): string | null {
	const match = detail.match(
		/https:\/\/console\.developers\.google\.com\/apis\/api\/translate\.googleapis\.com[^"\\\s]+/
	);
	return match?.[0] ?? null;
}

type GoogleTranslateError = Error & { detail?: string };

function logGoogleTranslateFailure(error: unknown): void {
	const detail = error instanceof Error ? (error as GoogleTranslateError).detail : undefined;
	if (detail && isTranslationApiDisabledError(detail)) {
		const url = extractTranslationApiActivationUrl(detail);
		console.warn(
			'[translate-google] Cloud Translation API désactivée sur le projet Google' +
				(url ? ` : ${url}` : '')
		);
		return;
	}
	console.warn('[translate-google]', error);
}

function splitTextForTranslation(text: string, maxLen: number): string[] {
	if (text.length <= maxLen) return [text];

	const chunks: string[] = [];
	let rest = text;

	while (rest.length > maxLen) {
		let splitAt = rest.lastIndexOf('\n\n', maxLen);
		if (splitAt < maxLen * 0.5) splitAt = rest.lastIndexOf('\n', maxLen);
		if (splitAt < maxLen * 0.5) splitAt = rest.lastIndexOf(' ', maxLen);
		if (splitAt <= 0) splitAt = maxLen;

		chunks.push(rest.slice(0, splitAt).trim());
		rest = rest.slice(splitAt).trim();
	}

	if (rest) chunks.push(rest);
	return chunks.filter(Boolean);
}

async function translateChunk(text: string, auth: TranslateAuth): Promise<string> {
	const url =
		auth.mode === 'apiKey'
			? `${TRANSLATE_URL}?key=${encodeURIComponent(auth.apiKey)}`
			: TRANSLATE_URL;
	const headers: HeadersInit = { 'Content-Type': 'application/json' };
	if (auth.mode === 'oauth') {
		headers['Authorization'] = `Bearer ${auth.accessToken}`;
	}

	const res = await fetch(url, {
		method: 'POST',
		headers,
		body: JSON.stringify({ q: text, target: 'fr', format: 'text' })
	});

	if (!res.ok) {
		const detail = await res.text().catch(() => '');
		const err = new Error(
			`Google Translate HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`
		) as Error & { detail?: string; insufficientScope?: boolean };
		err.detail = detail;
		err.insufficientScope = isInsufficientScopeError(res.status, detail);
		throw err;
	}

	const json = (await res.json()) as {
		data?: { translations?: { translatedText?: string }[] };
	};
	const translated = json.data?.translations?.[0]?.translatedText;
	if (typeof translated !== 'string') {
		throw new Error('Réponse Google Translate invalide');
	}
	return translated;
}

/** Traduction via Google Cloud Translation (OAuth ou GOOGLE_API_KEY, API payante au-delà du quota). */
export async function translateTextToFrenchGoogle(text: string): Promise<string | null> {
	const trimmed = text.trim();
	if (!trimmed) return null;

	const authOptions = await resolveTranslateAuthOptions();
	if (authOptions.length === 0) return null;

	const chunks = splitTextForTranslation(trimmed, MAX_CHUNK_CHARS);
	let lastError: unknown;

	for (let i = 0; i < authOptions.length; i++) {
		const auth = authOptions[i];
		const hasFallback = i < authOptions.length - 1;

		try {
			const parts: string[] = [];
			for (const chunk of chunks) {
				parts.push(await translateChunk(chunk, auth));
			}
			return parts.join('\n\n').trim() || null;
		} catch (error) {
			lastError = error;
			const scopeError =
				error instanceof Error &&
				'insufficientScope' in error &&
				(error as Error & { insufficientScope?: boolean }).insufficientScope;

			if (scopeError && auth.mode === 'oauth') {
				console.warn(
					'[translate-google] scope Cloud Translation manquant — reconnectez OAuth ou utilisez TRANSLATION_PROVIDER=mymemory'
				);
				if (hasFallback) continue;
			}
			logGoogleTranslateFailure(error);
			return null;
		}
	}

	logGoogleTranslateFailure(lastError);
	return null;
}

export async function hasGoogleTranslationConfigured(): Promise<boolean> {
	return (await resolveTranslateAuthOptions()).length > 0;
}
