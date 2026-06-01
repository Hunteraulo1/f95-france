/** Cible de téléchargement extension (build Firefox .xpi vs Chromium .zip). */
export type ExtensionBrowserTarget = 'firefox' | 'chromium' | 'unknown';

export type ExtensionDownloadUrls = {
	page: string;
	firefox: string;
	chromium: string;
};

export function detectExtensionBrowserTarget(
	userAgent: string | null | undefined
): ExtensionBrowserTarget {
	const ua = userAgent ?? '';
	if (!ua) return 'unknown';

	// Firefox (pas SeaMonkey / Waterfox traités comme Firefox principal)
	if (/Firefox\//i.test(ua) && !/Seamonkey/i.test(ua)) {
		return 'firefox';
	}

	// Chrome, Edge, Opera, Brave, Chromium → archive zip manuelle
	if (
		/Chrome\//i.test(ua) ||
		/Chromium\//i.test(ua) ||
		/Edg\//i.test(ua) ||
		/OPR\//i.test(ua) ||
		/Brave\//i.test(ua)
	) {
		return 'chromium';
	}

	return 'unknown';
}

export function extensionDownloadHref(
	target: ExtensionBrowserTarget,
	urls: ExtensionDownloadUrls
): string {
	if (target === 'firefox') return urls.firefox;
	if (target === 'chromium') return urls.chromium;
	return urls.page;
}

export function extensionDownloadButtonLabel(target: ExtensionBrowserTarget): string {
	switch (target) {
		case 'firefox':
			return 'Télécharger pour Firefox';
		case 'chromium':
			return 'Télécharger pour Chrome';
		default:
			return 'Télécharger l’extension';
	}
}

export function extensionDownloadHint(target: ExtensionBrowserTarget): string {
	switch (target) {
		case 'firefox':
			return 'Fichier .xpi — mise à jour automatique';
		case 'chromium':
			return 'Archive .zip — Chrome, Edge, Brave, Opera';
		default:
			return 'Firefox · Chrome · Edge · Brave · Opera';
	}
}

export function extensionAlternateDownloadLabel(target: ExtensionBrowserTarget): string | null {
	switch (target) {
		case 'firefox':
			return 'Sur Chrome, Edge, Brave ou Opera ? Télécharger l’archive .zip';
		case 'chromium':
			return 'Sur Firefox, Zen Browser ou Waterfox ? Télécharger le fichier .xpi';
		default:
			return null;
	}
}

export function extensionAlternateDownloadHref(
	target: ExtensionBrowserTarget,
	urls: ExtensionDownloadUrls
): string | null {
	switch (target) {
		case 'firefox':
			return urls.chromium;
		case 'chromium':
			return urls.firefox;
		default:
			return null;
	}
}
