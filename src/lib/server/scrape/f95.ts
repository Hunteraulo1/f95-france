import type { FormGameType } from '$lib/types';
import { parseHTML } from 'linkedom';

interface F95CheckerResponse {
	status: 'ok' | 'error' | string;
	msg: Record<string, string> | string;
}

type GameTypeEnum = FormGameType['type'];

export interface ScrapedF95Game {
	name: string | null;
	version: string | null;
	status: string | null;
	tags: string | null;
	type: GameTypeEnum | null;
	image: string | null;
}

const USER_AGENT =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) f95-france/1.0';
const THREAD_URL = 'https://f95zone.to/threads';
const CHECKER_URL = 'https://f95zone.to/sam/checker.php?threads=';

const htmlEntities: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&#39;': "'",
	'&quot;': '"'
};

const unescapeHtml = (input: string | null | undefined): string | null => {
	if (!input) return null;
	return input.replace(
		/(&amp;|&lt;|&gt;|&#39;|&quot;)/g,
		(entity) => htmlEntities[entity] ?? entity
	);
};

const fetchF95Version = async (threadId: string): Promise<string | null> => {
	const response = await fetch(`${CHECKER_URL}${threadId}`, {
		headers: {
			'User-Agent': USER_AGENT
		}
	});

	if (!response.ok) return null;

	const json = (await response.json()) as F95CheckerResponse;

	if (json.status !== 'ok' || typeof json.msg !== 'object' || json.msg === null) {
		return null;
	}

	return json.msg[threadId] ?? null;
};

const scrapeGetTitle = (tokens: string[]): { status: string | null; type: GameTypeEnum | null } => {
	let status: string | null = null;
	let type: GameTypeEnum | null = null;

	for (const token of tokens) {
		if (!status || status === 'EN COURS') {
			switch (token) {
				case 'Abandoned':
					status = 'ABANDONNÉ';
					break;
				case 'Completed':
					status = 'TERMINÉ';
					break;
				default:
					status = 'EN COURS';
					break;
			}
		}

		switch (token) {
			case "Ren'Py":
				type = 'renpy';
				break;
			case 'RPGM':
				type = 'rpgm';
				break;
			case 'Unity':
				type = 'unity';
				break;
			case 'Unreal Engine':
				type = 'unreal';
				break;
			case 'Flash':
				type = 'flash';
				break;
			case 'HTML':
				type = 'html';
				break;
			case 'QSP':
				type = 'qsp';
				break;
			case 'Others':
				type = 'other';
				break;
			default:
				break;
		}
	}

	return { status, type };
};

export const scrapeF95Thread = async (threadId: number): Promise<ScrapedF95Game> => {
	if (!threadId || Number.isNaN(threadId)) {
		throw new Error('threadId invalide');
	}

	const response = await fetch(`${THREAD_URL}/${threadId}`, {
		headers: {
			'User-Agent': USER_AGENT
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
	const { status, type } = titleMatch ? scrapeGetTitle(titleMatch) : { status: null, type: null };

	const titleText = document.querySelector('.p-title-value')?.textContent ?? '';
	const name = unescapeHtml(titleText.split('[')[0]?.trim() ?? null);

	const imgSrc =
		document.querySelector<HTMLImageElement>('img.bbImage')?.getAttribute('src') ?? null;
	const image = imgSrc ? imgSrc.replace('thumb/', '') : null;

	let version: string | null = null;
	try {
		version = await fetchF95Version(String(threadId));
	} catch (error) {
		console.warn('Impossible de récupérer la version du jeu', error);
	}

	return {
		name,
		version,
		status,
		tags,
		type,
		image
	};
};
