import { detectExtensionBrowserTarget } from '$lib/extension-browser';
import { getExtensionReleaseDownloadUrls } from '$lib/server/extension-release-downloads';
import { getHomePayload, HOME_CACHE_CONTROL } from '$lib/server/home-page-data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, setHeaders }) => {
	const extensionBrowserTarget = detectExtensionBrowserTarget(request.headers.get('user-agent'));

	try {
		const payload = await getHomePayload();
		setHeaders({ 'cache-control': HOME_CACHE_CONTROL });
		return {
			...payload,
			extensionBrowserTarget
		};
	} catch (error) {
		console.error('Erreur chargement accueil:', error);
		setHeaders({ 'cache-control': 'no-store' });
		const extensionDownloads = await getExtensionReleaseDownloadUrls();
		return {
			updates: [],
			team: [],
			extensionMockupGames: [],
			extensionDownloads,
			extensionBrowserTarget,
			error: 'Impossible de charger les mises a jour pour le moment.'
		};
	}
};
