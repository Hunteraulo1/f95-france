import { literal, minLength, pipe, safeParse, string, trim, union, url } from 'valibot';

const RequiredHttpUrlSchema = pipe(
	string(),
	trim(),
	minLength(1, 'URL requise'),
	url('URL invalide (http:// ou https://)')
);

const OptionalHttpUrlSchema = union([pipe(string(), trim(), literal('')), RequiredHttpUrlSchema]);

function trimValue(value: unknown): string {
	if (value == null) return '';
	return String(value).trim();
}

function isNoTranslationTname(tname: string | null | undefined): boolean {
	return (tname ?? '') === 'no_translation';
}

function isIntegratedTname(tname: string | null | undefined): boolean {
	return (tname ?? '') === 'integrated';
}

export function safeParseRequiredHttpUrl(value: unknown) {
	return safeParse(RequiredHttpUrlSchema, value);
}

export function safeParseOptionalHttpUrl(value: unknown) {
	return safeParse(OptionalHttpUrlSchema, value);
}

export function isValidRequiredHttpUrl(value: unknown): boolean {
	return safeParseRequiredHttpUrl(value).success;
}

export function isValidOptionalHttpUrl(value: unknown): boolean {
	return safeParseOptionalHttpUrl(value).success;
}

/** Message lisible à partir d’un échec `safeParse` sur une URL. */
export function formatHttpUrlIssue(
	label: string,
	result: ReturnType<typeof safeParseRequiredHttpUrl>
): string {
	if (result.success) return '';
	const issue = result.issues[0];
	const detail = issue?.message ?? 'URL invalide';
	return `${label} : ${detail}`;
}

export function validateGameLinkFields(input: {
	link?: unknown;
	image?: unknown;
	requireLink?: boolean;
	requireImage?: boolean;
}): string | null {
	const link = trimValue(input.link);
	if (input.requireLink !== false) {
		if (!link) return 'Lien du jeu requis';
		const parsed = safeParseRequiredHttpUrl(link);
		if (!parsed.success) return formatHttpUrlIssue('Lien du jeu', parsed);
	} else if (link) {
		const parsed = safeParseRequiredHttpUrl(link);
		if (!parsed.success) return formatHttpUrlIssue('Lien du jeu', parsed);
	}

	const image = trimValue(input.image);
	if (input.requireImage && !image) return null;
	if (image) {
		const parsed = safeParseRequiredHttpUrl(image);
		if (!parsed.success) return formatHttpUrlIssue('Image', parsed);
	}

	return null;
}

export function validateTranslationLinkField(input: {
	tlink?: unknown;
	tname?: string | null;
}): string | null {
	const tname = input.tname ?? '';
	const tlink = trimValue(input.tlink);

	if (isNoTranslationTname(tname) || isIntegratedTname(tname)) {
		if (tlink) {
			const parsed = safeParseRequiredHttpUrl(tlink);
			if (!parsed.success) return formatHttpUrlIssue('Lien de traduction', parsed);
		}
		return null;
	}

	if (!tlink) return 'Lien de traduction requis';
	const parsed = safeParseRequiredHttpUrl(tlink);
	if (!parsed.success) return formatHttpUrlIssue('Lien de traduction', parsed);
	return null;
}

export function validateTranslatorPageLinks(
	pages: Array<{ name?: string; link?: string }>
): string | null {
	for (const [index, page] of pages.entries()) {
		const name = trimValue(page.name);
		const link = trimValue(page.link);
		if (!name && !link) continue;
		if (name && !link) {
			return `Page traducteur ${index + 1} : lien requis`;
		}
		if (link) {
			const parsed = safeParseRequiredHttpUrl(link);
			if (!parsed.success) {
				return formatHttpUrlIssue(`Page traducteur ${index + 1}`, parsed);
			}
		}
	}
	return null;
}

export function validateSubmissionEditLinks(input: {
	submissionType: string;
	gameLink?: string;
	gameImage?: string;
	gameWebsite?: string;
	translationTlink?: string;
	translationTname?: string;
	includeTranslation?: boolean;
	translatorPages?: Array<{ name?: string; link?: string }>;
	requireGameImage?: boolean;
}): string | null {
	if (input.submissionType === 'translator_pages') {
		return validateTranslatorPageLinks(input.translatorPages ?? []);
	}

	if (input.submissionType === 'delete') return null;

	if (input.submissionType === 'translation') {
		return validateTranslationLinkField({
			tlink: input.translationTlink,
			tname: input.translationTname
		});
	}

	if (input.submissionType === 'game' || input.submissionType === 'update') {
		const gameError = validateGameLinkFields({
			link: input.gameLink,
			image: input.gameImage,
			requireLink: true,
			requireImage: input.requireGameImage ?? true
		});
		if (gameError) return gameError;

		if (input.includeTranslation) {
			return validateTranslationLinkField({
				tlink: input.translationTlink,
				tname: input.translationTname
			});
		}
	}

	return null;
}
