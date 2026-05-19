import { scrapeThread, type ScrapeWebsite } from '$lib/server/scrape';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Non authentifié' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { website, threadId } = body as {
			website?: ScrapeWebsite | 'other';
			threadId?: number | string;
		};

		if (!website || typeof threadId === 'undefined' || threadId === null) {
			return json({ error: 'Site web et ID de thread requis' }, { status: 400 });
		}

		if (website !== 'f95z' && website !== 'lc') {
			return json({ error: "Le scraping n'est disponible que pour F95Zone et LewdCorner" }, {
				status: 400
			});
		}

		const numericThreadId = Number(threadId);

		if (!Number.isFinite(numericThreadId) || numericThreadId <= 0) {
			return json({ error: 'ID de thread invalide' }, { status: 400 });
		}

		const scrapedData = await scrapeThread(website, numericThreadId);

		return json({ success: true, data: scrapedData });
	} catch (error) {
		console.warn('Erreur lors du scraping:', error);
		const detail = error instanceof Error ? error.message : '';
		const notFound = /\b404\b/.test(detail) || /introuvable/i.test(detail);
		return json(
			{
				success: false,
				error: notFound
					? 'Thread introuvable sur le forum'
					: 'Forum temporairement inaccessible ou réponse invalide'
			},
			{ status: notFound ? 404 : 502 }
		);
	}
};
