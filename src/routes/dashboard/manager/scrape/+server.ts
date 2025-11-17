import { scrapeF95Thread } from '$lib/server/scrape/f95';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { website, threadId } = body as {
			website?: 'f95z' | 'lc' | 'other';
			threadId?: number | string;
		};

		if (!website || typeof threadId === 'undefined' || threadId === null) {
			return json({ error: 'Site web et ID de thread requis' }, { status: 400 });
		}

		if (website !== 'f95z') {
			return json({ error: "Le scraping n'est disponible que pour F95Zone" }, { status: 400 });
		}

		const numericThreadId = Number(threadId);

		if (!Number.isFinite(numericThreadId) || numericThreadId <= 0) {
			return json({ error: 'ID de thread invalide' }, { status: 400 });
		}

		const scrapedData = await scrapeF95Thread(numericThreadId);

		return json({ success: true, data: scrapedData });
	} catch (error) {
		console.error('Erreur lors du scraping:', error);
		return json({ error: 'Erreur serveur lors du scraping' }, { status: 500 });
	}
};
