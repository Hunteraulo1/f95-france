import { LEGAL_DOCUMENTS } from '$lib/legal-documents';
import { loadLegalDocumentFromCdn } from '$lib/server/legal-document';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const doc = LEGAL_DOCUMENTS['legal-notice'];

export const load: PageServerLoad = async ({ setHeaders }) => {
	const result = await loadLegalDocumentFromCdn(doc.cdnUrl);

	setHeaders({
		'cache-control': 'public, max-age=300, stale-while-revalidate=600'
	});

	if (!result.ok) {
		error(503, result.message);
	}

	return {
		title: doc.title,
		description: doc.description,
		blocks: result.blocks,
		updatedAt: result.updatedAt,
		sourceUrl: doc.cdnUrl
	};
};
