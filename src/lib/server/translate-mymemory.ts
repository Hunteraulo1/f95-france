import { privateEnv } from '$lib/server/private-env';

const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
/** Limite API gratuite ~500 octets par requête */
const MAX_CHUNK_BYTES = 450;

type MyMemoryResponse = {
	responseData?: { translatedText?: string };
	responseStatus?: number;
	responseDetails?: string;
	quotaFinished?: boolean;
};

function utf8ByteLength(text: string): number {
	return new TextEncoder().encode(text).length;
}

function splitTextByUtf8Bytes(text: string, maxBytes: number): string[] {
	if (utf8ByteLength(text) <= maxBytes) return [text];

	const chunks: string[] = [];
	let rest = text;

	while (rest.length > 0) {
		if (utf8ByteLength(rest) <= maxBytes) {
			chunks.push(rest);
			break;
		}

		let low = 1;
		let high = rest.length;
		while (low < high) {
			const mid = Math.ceil((low + high) / 2);
			const slice = rest.slice(0, mid);
			if (utf8ByteLength(slice) <= maxBytes) {
				low = mid;
			} else {
				high = mid - 1;
			}
		}

		let splitAt = low;
		if (splitAt <= 0) splitAt = 1;

		const breakAt = Math.max(
			rest.lastIndexOf('\n\n', splitAt),
			rest.lastIndexOf('\n', splitAt),
			rest.lastIndexOf(' ', splitAt)
		);
		if (breakAt > splitAt * 0.4) splitAt = breakAt;

		chunks.push(rest.slice(0, splitAt).trim());
		rest = rest.slice(splitAt).trim();
	}

	return chunks.filter(Boolean);
}

async function translateChunk(text: string): Promise<string> {
	const params = new URLSearchParams({
		q: text,
		langpair: 'en|fr'
	});
	const contact = privateEnv('MYMEMORY_CONTACT_EMAIL');
	if (contact) params.set('de', contact);

	const res = await fetch(`${MYMEMORY_URL}?${params.toString()}`);
	if (!res.ok) {
		throw new Error(`MyMemory HTTP ${res.status}`);
	}

	const json = (await res.json()) as MyMemoryResponse;
	if (json.quotaFinished || json.responseDetails?.includes('QUOTA')) {
		throw new Error('MyMemory : quota journalier dépassé');
	}
	if (json.responseStatus && json.responseStatus !== 200) {
		throw new Error(`MyMemory : ${json.responseDetails ?? json.responseStatus}`);
	}

	const translated = json.responseData?.translatedText;
	if (typeof translated !== 'string' || !translated.trim()) {
		throw new Error('Réponse MyMemory invalide');
	}
	return translated.trim();
}

/** Traduction EN→FR via MyMemory (gratuit, sans hébergement). */
export async function translateTextToFrenchMyMemory(text: string): Promise<string | null> {
	const trimmed = text.trim();
	if (!trimmed) return null;

	try {
		const chunks = splitTextByUtf8Bytes(trimmed, MAX_CHUNK_BYTES);
		const parts: string[] = [];
		for (const chunk of chunks) {
			parts.push(await translateChunk(chunk));
		}
		return parts.join('\n\n').trim() || null;
	} catch (error) {
		console.warn('[translate-mymemory]', error);
		return null;
	}
}
