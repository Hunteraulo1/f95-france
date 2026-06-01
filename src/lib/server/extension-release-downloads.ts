import type { ExtensionDownloadUrls } from '$lib/extension-browser';
import { SITE } from '$lib/site';

const GITHUB_LATEST_API = 'https://api.github.com/repos/Hunteraulo1/f95list-ext/releases/latest';

const fallbackUrls = (): ExtensionDownloadUrls => ({
	page: SITE.extensionDownloadUrl,
	firefox: SITE.extensionDownloadUrl,
	chromium: SITE.extensionDownloadUrl
});

/** URLs directes des assets de la dernière release GitHub (cache mémoire court). */
let cached: { urls: ExtensionDownloadUrls; at: number } | null = null;
const CACHE_MS = 60 * 60 * 1000;

export async function getExtensionReleaseDownloadUrls(): Promise<ExtensionDownloadUrls> {
	const now = Date.now();
	if (cached && now - cached.at < CACHE_MS) {
		return cached.urls;
	}

	try {
		const res = await fetch(GITHUB_LATEST_API, {
			headers: {
				Accept: 'application/vnd.github+json',
				'User-Agent': 'f95-france-site'
			}
		});
		if (!res.ok) {
			return fallbackUrls();
		}

		const data = (await res.json()) as {
			assets?: Array<{ name?: string; browser_download_url?: string }>;
		};

		const assets = data.assets ?? [];
		const firefoxAsset = assets.find((a) => a.name?.toLowerCase().includes('firefox'));
		const chromeAsset = assets.find((a) => a.name?.toLowerCase().includes('chrome'));

		const urls: ExtensionDownloadUrls = {
			page: SITE.extensionDownloadUrl,
			firefox: firefoxAsset?.browser_download_url ?? SITE.extensionDownloadUrl,
			chromium: chromeAsset?.browser_download_url ?? SITE.extensionDownloadUrl
		};

		cached = { urls, at: now };
		return urls;
	} catch (error) {
		console.error('Impossible de résoudre les URLs extension:', error);
		return fallbackUrls();
	}
}
