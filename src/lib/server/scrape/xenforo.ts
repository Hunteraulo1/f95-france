import type { GameEngineType } from '$lib/types';

const htmlEntities: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&#39;': "'",
	'&quot;': '"'
};

export const SCRAPE_USER_AGENT =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) f95-france/1.0';

export const unescapeHtml = (input: string | null | undefined): string | null => {
	if (!input) return null;
	return input.replace(
		/(&amp;|&lt;|&gt;|&#39;|&quot;)/g,
		(entity) => htmlEntities[entity] ?? entity
	);
};

export const parseTitleTokens = (
	tokens: string[]
): { status: string | null; gameType: GameEngineType | null } => {
	let status: string | null = null;
	let gameType: GameEngineType | null = null;

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
				gameType = 'renpy';
				break;
			case 'RPGM':
				gameType = 'rpgm';
				break;
			case 'Unity':
				gameType = 'unity';
				break;
			case 'Unreal Engine':
				gameType = 'unreal';
				break;
			case 'Flash':
				gameType = 'flash';
				break;
			case 'HTML':
				gameType = 'html';
				break;
			case 'QSP':
				gameType = 'qsp';
				break;
			case 'Others':
				gameType = 'other';
				break;
			default:
				break;
		}
	}

	return { status, gameType };
};

/** Extrait une version du titre XenForo (ex. [v1.0], v1.0). */
export const parseVersionFromTitle = (rawTitle: string): string | null => {
	const bracket = rawTitle.match(/\[\s*v?([0-9][\w.-]*)\s*\]/i);
	if (bracket?.[1]) return bracket[1];

	const inline = rawTitle.match(/\bv([0-9][\w.-]*)\b/i);
	if (inline?.[1]) return inline[1];

	return null;
};
