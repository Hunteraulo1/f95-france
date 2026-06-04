import { appLogOperational } from '$lib/server/app-log-bridge';
import { resolveGameImageSrc } from '$lib/utils/game-image-url';
import { parseHTML } from 'linkedom';
import type { ScrapedThreadGame } from './types';
import {
    parseTitleTokens,
    parseVersionFromTitle,
    SCRAPE_USER_AGENT,
    unescapeHtml
} from './xenforo';

const THREAD_URL = 'https://lewdcorner.com/threads';
const LC_BLOCKED_LINK_PATTERNS = [
	/you must be registered to see links/i,
	/vous devez (?:être|etre) inscrit pour voir les liens/i
];
const LC_SECTION_STOP_MARKERS = [
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

interface LcJsonLdMainEntity {
	headline?: string;
	keywords?: string;
	url?: string;
	text?: string;
}

interface LcJsonLd {
	mainEntity?: LcJsonLdMainEntity;
}

const isLoginOrBlockedPage = (html: string, finalUrl: string): boolean => {
	if (/\/login/i.test(finalUrl)) return true;
	if (html.includes('template-login') || html.includes('data-template="login"')) return true;
	return false;
};

const parseLcJsonLd = (document: Document): LcJsonLdMainEntity | null => {
	const script = document.querySelector('script[type="application/ld+json"]');
	if (!script?.textContent?.trim()) return null;
	try {
		const parsed = JSON.parse(script.textContent) as LcJsonLd;
		return parsed.mainEntity ?? null;
	} catch {
		return null;
	}
};

const parseThreadIdFromLcUrl = (url: string | undefined): number | null => {
	if (!url) return null;
	const match = url.match(/\.(\d+)\/?(?:#.*)?$/);
	if (!match?.[1]) return null;
	const id = Number.parseInt(match[1], 10);
	return Number.isFinite(id) && id > 0 ? id : null;
};

/** Aligné sur l’extension : texte avant le premier `[` dans le headline JSON-LD. */
const parseNameFromHeadline = (headline: string | undefined): string | null => {
	if (!headline?.trim()) return null;
	const name = headline.match(/([^[]*)/)?.[1]?.trim();
	return name ? unescapeHtml(name) : null;
};

const parseVersionFromCustomField = (document: Document): string | null => {
	const dd = document.querySelector('dl[data-field="version"] > dd');
	const version = dd?.textContent?.trim();
	return version || null;
};

const parseDescriptionFromLdText = (text: string | undefined): string | null => {
	if (!text?.trim()) return null;
	const parts = text.split(/Overview:\s*/i);
	if (parts.length < 2) return text.trim() || null;
	const afterOverview = parts[1] ?? '';
	const stopMarkers = ['DOWNLOAD', 'DOWNLOADS', 'DEVELOPER', 'DEVELOPERS', 'THREAD UPDATED'];
	let desc = afterOverview;
	for (const marker of stopMarkers) {
		const idx = desc.indexOf(marker);
		if (idx >= 0) desc = desc.slice(0, idx);
	}
	desc = desc.trim();
	return desc || null;
};

const normalizeDescription = (input: string): string =>
	input
		.replace(/\r/g, '')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();

const stripOverviewPrefix = (input: string): string =>
	input.replace(/^\s*(?:\*+\s*)?overview\s*:\s*/i, '');

const scrubLcDescriptionNoise = (input: string): string | null => {
	if (!input.trim()) return null;
	const lines = input
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.filter((line) => !LC_BLOCKED_LINK_PATTERNS.some((pattern) => pattern.test(line)));

	const stopRegex = new RegExp(
		`^(?:${LC_SECTION_STOP_MARKERS.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?:\\b|\\s*:|\\s+-|$)`,
		'i'
	);
	const firstMetaLineIdx = lines.findIndex((line) => stopRegex.test(line));
	const keptLines = firstMetaLineIdx >= 0 ? lines.slice(0, firstMetaLineIdx) : lines;

	const cleaned = normalizeDescription(keptLines.join('\n'));
	return cleaned || null;
};

const extractLcDescriptionFromHtml = (document: Document): string | null => {
	const wrapper = document.querySelector('.message-body .bbWrapper');
	if (!wrapper) return null;

	const root = wrapper.cloneNode(true) as HTMLElement;
	root
		.querySelectorAll(
			[
				'.bbCodeSpoiler',
				'.bbCodeSpoilerContainer',
				'[data-xf-click="spoiler"]',
				'.bbCodeBlock-title',
				'style',
				'script'
			].join(', ')
		)
		.forEach((el) => el.remove());

	const raw = normalizeDescription(stripOverviewPrefix(root.textContent ?? ''));
	return scrubLcDescriptionNoise(raw);
};

const pickThreadImage = (document: Document): string | null => {
	const img = document.querySelector<HTMLImageElement>('img.bbImage');
	const src = img?.getAttribute('src')?.trim();
	if (!src || src.includes('/data/avatars/')) return null;
	return resolveGameImageSrc(src.replace(/\/thumb\//, '/'), { website: 'lc' });
};

const parseStatusAndTypeFromTitle = (
	document: Document
): { status: string | null; gameType: ScrapedThreadGame['gameType'] } => {
	const pageTitle = (document.title ?? '').replace(/\s*\|\s*LewdCorner\s*$/i, '').trim();
	const titleTokens = pageTitle.match(/([\w'’]+)(?=\s-)/gi) ?? [];
	if (titleTokens.length > 0) {
		return parseTitleTokens(titleTokens);
	}
	const pTitle =
		document.querySelector('.p-title-value')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
	const pTokens = pTitle.match(/([\w'’]+)(?=\s|$)/gi) ?? [];
	return parseTitleTokens(pTokens);
};

export const scrapeLcThread = async (threadId: number): Promise<ScrapedThreadGame> => {
	if (!threadId || Number.isNaN(threadId)) {
		throw new Error('threadId invalide');
	}

	const response = await fetch(`${THREAD_URL}/${threadId}/`, {
		headers: {
			'User-Agent': SCRAPE_USER_AGENT,
			Accept: 'text/html,application/xhtml+xml'
		},
		redirect: 'follow'
	});

	const finalUrl = response.url;

	if (!response.ok) {
		throw new Error(`Impossible de récupérer le thread ${threadId}: ${response.status}`);
	}

	const html = await response.text();

	if (isLoginOrBlockedPage(html, finalUrl)) {
		throw new Error(
			`Accès au thread ${threadId} refusé (connexion ou restrictions LewdCorner requises)`
		);
	}

	const { document } = parseHTML(html);
	const jsonLd = parseLcJsonLd(document);

	const urlThreadId = parseThreadIdFromLcUrl(jsonLd?.url ?? finalUrl);
	if (urlThreadId !== null && urlThreadId !== threadId) {
		appLogOperational({
			level: 'debug',
			source: 'scrape',
			message: `LC threadId demandé ${threadId} ≠ id URL ${urlThreadId}`,
			meta: { threadId, urlThreadId }
		});
	}

	const { status, gameType } = parseStatusAndTypeFromTitle(document);
	const rawPageTitle =
		document.querySelector('.p-title-value')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
	const name =
		parseNameFromHeadline(jsonLd?.headline) ??
		unescapeHtml(rawPageTitle.replace(/\s*\[.*$/, '') || null);
	const version = parseVersionFromCustomField(document) ?? parseVersionFromTitle(rawPageTitle);
	const tags = jsonLd?.keywords?.trim() || null;
	const description =
		scrubLcDescriptionNoise(parseDescriptionFromLdText(jsonLd?.text) ?? '') ??
		extractLcDescriptionFromHtml(document) ??
		null;

	const image = pickThreadImage(document);

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
