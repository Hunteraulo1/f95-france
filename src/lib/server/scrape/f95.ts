import type { ScrapedThreadGame } from '#lib/scrape/types';
import { resolveGameImageSrc } from '#lib/utils/game-image-url';
import {
	fetchF95ScraperThread,
	type F95ScraperThread,
	type F95ScraperThreadStatus
} from './f95-scraper';

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

/** Libellés de statut historiques du scrape HTML (titre du thread). F95 « On hold » n’avait pas de libellé : EN COURS. */
const STATUS_LABELS: Record<NonNullable<F95ScraperThreadStatus>, string> = {
	in_progress: 'EN COURS',
	on_hold: 'EN COURS',
	completed: 'TERMINÉ',
	abandoned: 'ABANDONNÉ'
};

/**
 * Convertit un thread renvoyé par le scraper au format historique du scrape HTML.
 * `tags` et `gameType` restent nuls : l’API ne donne que des identifiants numériques, pas encore
 * convertis. Les appelants conservent alors les valeurs existantes.
 */
export const scrapedFromF95Thread = (
	thread: F95ScraperThread,
	status: F95ScraperThreadStatus
): ScrapedThreadGame => {
	const description = scrubF95DescriptionNoise(
		normalizeDescription(stripOverviewPrefix(thread.description))
	);
	const imageUrl = thread.imageUrl?.trim();

	return {
		name: thread.name.trim() || null,
		version: thread.version?.trim() || null,
		description,
		status: status ? STATUS_LABELS[status] : null,
		tags: null,
		gameType: null,
		image: imageUrl
			? resolveGameImageSrc(imageUrl.replace('thumb/', ''), { website: 'f95z' })
			: null
	};
};

export const scrapeF95Thread = async (threadId: number): Promise<ScrapedThreadGame> => {
	if (!threadId || Number.isNaN(threadId)) {
		throw new Error('threadId invalide');
	}

	const { thread, status } = await fetchF95ScraperThread(threadId);
	return scrapedFromF95Thread(thread, status);
};
