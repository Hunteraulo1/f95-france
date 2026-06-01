import { cdnMarkdownFetchUrl } from '$lib/legal-documents';
import { parseMarkdownDocument, type MarkdownBlock } from '$lib/markdown/content';

const FETCH_TIMEOUT_MS = 15_000;

export type LegalDocumentLoad =
	| { ok: true; blocks: MarkdownBlock[]; updatedAt: string | null }
	| { ok: false; message: string };

export async function loadLegalDocumentFromCdn(publicCdnUrl: string): Promise<LegalDocumentLoad> {
	const fetchUrl = cdnMarkdownFetchUrl(publicCdnUrl);

	try {
		const response = await fetch(fetchUrl, {
			headers: { Accept: 'text/markdown, text/plain, */*' },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
		});

		if (!response.ok) {
			return {
				ok: false,
				message: `Impossible de charger le document (${response.status}).`
			};
		}

		const markdown = await response.text();
		if (!markdown.trim()) {
			return { ok: false, message: 'Le document est vide.' };
		}

		const blocks = parseMarkdownDocument(markdown);
		const updatedAt = response.headers.get('last-modified');

		return { ok: true, blocks, updatedAt };
	} catch {
		return {
			ok: false,
			message: 'Le document est temporairement indisponible. Réessayez plus tard.'
		};
	}
}
