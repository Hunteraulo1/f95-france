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

const SPOILER_LOCKED_TEXT_PATTERNS = [
	/you don't have permission to view the spoiler content/i,
	/log in or register now/i,
	/you must be registered to see links/i,
	/vous devez (?:être|etre) inscrit pour voir les liens/i
];

const F95_SECTION_STOP_MARKERS = [
	'THREAD UPDATED',
	'RELEASE DATE',
	'ALIAS',
	'DEVELOPER',
	'CENSORED',
	'VERSION',
	'OS',
	'LANGUAGE',
	'GENRE',
	'INSTALLATION',
	'CHANGELOG',
	"DEVELOPER'S NOTES",
	'NOTES DU DÉVELOPPEUR',
	'NOTES DU DEVELOPPEUR',
	'DOWNLOAD',
	'TÉLÉCHARGER',
	'PATCHES',
	'EXTRAS'
];

const normalizeDescription = (input: string): string =>
	input
		.replace(/\r/g, '')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();

const stripOverviewPrefix = (input: string): string =>
	input.replace(/^\s*(?:\*+\s*)?overview\s*:\s*/i, '');

const scrubF95DescriptionNoise = (input: string): string | null => {
	if (!input.trim()) return null;
	const lines = input
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.filter((line) => !SPOILER_LOCKED_TEXT_PATTERNS.some((pattern) => pattern.test(line)));

	const stopRegex = new RegExp(
		`^(?:${F95_SECTION_STOP_MARKERS.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?:\\b|\\s*:|\\s+-|$)`,
		'i'
	);
	const firstMetaLineIdx = lines.findIndex((line) => stopRegex.test(line));
	const keptLines = firstMetaLineIdx >= 0 ? lines.slice(0, firstMetaLineIdx) : lines;

	const cleaned = normalizeDescription(keptLines.join('\n'));
	return cleaned || null;
};

const extractThreadDescription = (document: Document): string | null => {
	const wrapper = document.querySelector('.message-body > .bbWrapper');
	if (!wrapper) return null;

	const root = wrapper.cloneNode(true) as HTMLElement;

	// XenForo spoiler widgets and extra noisy blocks should never be persisted.
	root
		.querySelectorAll(
			[
				'.bbCodeSpoiler',
				'.bbCodeSpoilerContainer',
				'[data-xf-click="spoiler"]',
				'.js-unfurl-favicon',
				'style',
				'script'
			].join(', ')
		)
		.forEach((el) => el.remove());

	const text = normalizeDescription(stripOverviewPrefix(root.textContent ?? ''));
	if (!text) return null;

	return scrubF95DescriptionNoise(text);
};

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

	const description = extractThreadDescription(document);

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
