import { resolveGameImageSrc } from '$lib/utils/game-image-url';
import { parseHTML } from 'linkedom';
import type { ScrapedThreadGame } from './types';
import { parseTitleTokens, SCRAPE_USER_AGENT, unescapeHtml } from './xenforo';

export type { ScrapedThreadGame as ScrapedF95Game } from './types';

interface F95CheckerResponse {
	status: 'ok' | 'error' | string;
	msg: Record<string, string> | string;
}

const THREAD_URL = 'https://f95zone.to/threads';
const CHECKER_URL = 'https://f95zone.to/sam/checker.php?threads=';

const fetchF95Version = async (threadId: string): Promise<string | null> => {
	const response = await fetch(`${CHECKER_URL}${threadId}`, {
		headers: {
			'User-Agent': SCRAPE_USER_AGENT
		}
	});

	if (!response.ok) return null;

	const json = (await response.json()) as F95CheckerResponse;

	if (json.status !== 'ok' || typeof json.msg !== 'object' || json.msg === null) {
		return null;
	}

	return json.msg[threadId] ?? null;
};

export const scrapeF95Thread = async (threadId: number): Promise<ScrapedThreadGame> => {
	if (!threadId || Number.isNaN(threadId)) {
		throw new Error('threadId invalide');
	}

	const response = await fetch(`${THREAD_URL}/${threadId}`, {
		headers: {
			'User-Agent': SCRAPE_USER_AGENT
		}
	});

	if (!response.ok) {
		throw new Error(`Impossible de récupérer le thread ${threadId}: ${response.status}`);
	}

	const html = await response.text();
	const { document } = parseHTML(html);

	const tagsList = Array.from(document.querySelectorAll('.tagItem'))
		.map((tag) => tag.textContent?.trim())
		.filter((tag): tag is string => Boolean(tag));

	const tags = tagsList.length > 0 ? tagsList.join(', ') : null;

	const title = document.title ?? '';
	const titleMatch = title.match(/([\w\\']+)(?=\s-)/gi) ?? undefined;
	const { status, gameType } = titleMatch
		? parseTitleTokens(titleMatch)
		: { status: null, gameType: null };

	const description =
		document
			.querySelector('.message-body > .bbWrapper > div')
			?.textContent?.replace('Overview:', '')
			.trim() ?? null;

	const titleNode = document.querySelector('.p-title-value')?.cloneNode(true) as HTMLElement | null;

	if (titleNode) {
		titleNode.querySelectorAll('span, a').forEach((el) => el.remove());
	}

	const rawTitle = titleNode?.textContent ?? '';
	const name = unescapeHtml(
		rawTitle
			.replace(/\s+/g, ' ')
			.trim()
			.replace(/\s*\[.*$/, '') || null
	);

	const imgSrc =
		document.querySelector<HTMLImageElement>('img.bbImage')?.getAttribute('src') ?? null;
	const image = imgSrc
		? resolveGameImageSrc(imgSrc.replace('thumb/', ''), { website: 'f95z' })
		: null;

	let version: string | null = null;
	try {
		version = await fetchF95Version(String(threadId));
	} catch (error) {
		console.warn('Impossible de récupérer la version du jeu', error);
	}

	return {
		name,
		version,
		description,
		status,
		tags,
		gameType,
		image
	};
};
