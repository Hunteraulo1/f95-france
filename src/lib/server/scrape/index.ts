import type { ScrapedThreadGame } from '$lib/scrape/types';
import { scrapeF95Thread } from './f95';
import { scrapeLcThread } from './lc';

export type { ScrapedThreadGame as ScrapedF95Game, ScrapedThreadGame } from '$lib/scrape/types';
export { scrapeF95Thread } from './f95';
export { scrapeLcThread } from './lc';

export type ScrapeWebsite = 'f95z' | 'lc';

export async function scrapeThread(
	website: ScrapeWebsite,
	threadId: number
): Promise<ScrapedThreadGame> {
	if (website === 'f95z') return scrapeF95Thread(threadId);
	if (website === 'lc') return scrapeLcThread(threadId);
	throw new Error(`Site non supporté pour le scrape: ${website}`);
}
