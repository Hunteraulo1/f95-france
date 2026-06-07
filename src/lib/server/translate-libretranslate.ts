import { privateEnv } from '$lib/server/private-env';

/** LibreTranslate limite la taille des requêtes ; découpage conservateur. */
const MAX_CHUNK_CHARS = 4000;

type LibreTranslateResponse = {
	translatedText?: string;
	error?: string;
};

function resolveBaseUrl(): string | null {
	const raw = privateEnv('LIBRETRANSLATE_URL')?.trim();
	if (!raw) return null;
	return raw.replace(/\/+$/, '').replace(/\/translate$/i, '');
}

export function isLibreTranslateConfigured(): boolean {
	return resolveBaseUrl() !== null;
}

export function isDescriptionAutoTranslateEnabled(): boolean {
	const provider = privateEnv('TRANSLATION_PROVIDER')?.toLowerCase();
	if (provider === 'off' || provider === 'none' || provider === 'false') return false;

	const auto = privateEnv('DESCRIPTION_AUTO_TRANSLATE')?.toLowerCase();
	if (auto === 'off' || auto === 'none' || auto === 'false') return false;

	return isLibreTranslateConfigured();
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

async function translateChunk(text: string, baseUrl: string, apiKey?: string): Promise<string> {
	const body: Record<string, string> = {
		q: text,
		source: 'auto',
		target: 'fr',
		format: 'text'
	};
	if (apiKey) body.api_key = apiKey;

	const res = await fetch(`${baseUrl}/translate`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

	const json = (await res.json().catch(() => null)) as LibreTranslateResponse | null;

	if (!res.ok) {
		const detail = json?.error ?? (typeof json === 'object' ? JSON.stringify(json) : '');
		throw new Error(`LibreTranslate HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
	}

	const translated = json?.translatedText;
	if (typeof translated !== 'string' || !translated.trim()) {
		throw new Error('Réponse LibreTranslate invalide');
	}
	return translated.trim();
}

/** Traduction vers le français via [LibreTranslate](https://docs.libretranslate.com/). */
export async function translateTextToFrenchLibreTranslate(text: string): Promise<string | null> {
	const trimmed = text.trim();
	if (!trimmed) return null;

	const baseUrl = resolveBaseUrl();
	if (!baseUrl) return null;

	const apiKey = privateEnv('LIBRETRANSLATE_API_KEY');

	try {
		const chunks = splitTextForTranslation(trimmed, MAX_CHUNK_CHARS);
		const parts: string[] = [];
		for (const chunk of chunks) {
			parts.push(await translateChunk(chunk, baseUrl, apiKey));
		}
		return parts.join('\n\n').trim() || null;
	} catch (error) {
		console.warn('[translate-libretranslate]', error);
		return null;
	}
}
