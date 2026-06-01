/** URLs publiques des documents légaux sur le CDN (mises à jour côté Zipline). */
export const LEGAL_DOCUMENTS = {
	'legal-notice': {
		title: 'Mentions légales',
		description: 'Mentions légales du site F95 France.',
		cdnUrl: 'https://cdn.f95france.site/u/legal-notice.md'
	},
	'privacy-policy': {
		title: 'Politique de confidentialité',
		description:
			'Politique de confidentialité et traitement des données personnelles sur F95 France.',
		cdnUrl: 'https://cdn.f95france.site/u/privacy-policy.md'
	}
} as const;

export type LegalDocumentId = keyof typeof LEGAL_DOCUMENTS;

/** Le CDN sert le markdown brut sous `/raw/` ; `/u/` redirige vers la page de prévisualisation. */
export function cdnMarkdownFetchUrl(publicCdnUrl: string): string {
	const url = new URL(publicCdnUrl);
	if (url.pathname.startsWith('/u/')) {
		url.pathname = `/raw/${url.pathname.slice('/u/'.length)}`;
	}
	return url.href;
}
