export type TranslatorPageLink = { label: string; url: string };

export type CustomProfileTheme = {
	bio: string;
	backgroundUrl: string | null;
	musicUrl: string | null;
	cursorUrl: string | null;
};

export const PROFILE_BIO_MAX_LENGTH = 2000;
/** Dimensions recommandées pour l’image de fond du profil public. */
export const PROFILE_BACKGROUND_WIDTH = 1500;
export const PROFILE_BACKGROUND_HEIGHT = 900;
/** Ratio d’affichage du bandeau (1500×900 = 5:3). */
export const PROFILE_BACKGROUND_ASPECT_RATIO = '5 / 3' as const;
export const PROFILE_BACKGROUND_SIZE_LABEL = `${PROFILE_BACKGROUND_WIDTH}×${PROFILE_BACKGROUND_HEIGHT}px`;
/** Taille d’affichage du curseur personnalisé sur la zone profil (px). */
export const PROFILE_CURSOR_DISPLAY_PX = 32;
const PROFILE_MEDIA_URL_MAX_LENGTH = 2048;

export function parseTranslatorPages(raw: string | null | undefined): TranslatorPageLink[] {
	if (!raw?.trim()) return [];
	try {
		const parsed = JSON.parse(raw) as Array<{ name?: string; link?: string }>;
		if (!Array.isArray(parsed)) return [];
		return parsed
			.map((item) => ({
				label: String(item.name ?? '').trim(),
				url: String(item.link ?? '').trim()
			}))
			.filter((item) => item.label.length > 0 && item.url.length > 0);
	} catch {
		return [];
	}
}

export function normalizeProfileBio(raw: string | null | undefined): string {
	return String(raw ?? '')
		.trim()
		.slice(0, PROFILE_BIO_MAX_LENGTH);
}

export function normalizeOptionalMediaUrl(raw: string | null | undefined): string | null {
	const value = String(raw ?? '')
		.trim()
		.slice(0, PROFILE_MEDIA_URL_MAX_LENGTH);
	return value || null;
}

export function validateOptionalHttpUrl(
	raw: string | null | undefined,
	label: string
): string | null | { error: string } {
	const value = normalizeOptionalMediaUrl(raw);
	if (!value) return null;
	try {
		const url = new URL(value);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			return { error: `${label} : l’URL doit commencer par http:// ou https://` };
		}
		return value;
	} catch {
		return { error: `${label} : URL invalide` };
	}
}

export function buildCustomProfileTheme(row: {
	profileBio: string | null;
	profileBackgroundUrl: string | null;
	profileMusicUrl: string | null;
	profileCursorUrl: string | null;
}): CustomProfileTheme {
	return {
		bio: normalizeProfileBio(row.profileBio),
		backgroundUrl: normalizeOptionalMediaUrl(row.profileBackgroundUrl),
		musicUrl: normalizeOptionalMediaUrl(row.profileMusicUrl),
		cursorUrl: normalizeOptionalMediaUrl(row.profileCursorUrl)
	};
}

export function hasCustomProfilePresentation(
	theme: CustomProfileTheme | null | undefined,
	translatorLinks: TranslatorPageLink[]
): boolean {
	if (!theme) return translatorLinks.length > 0;
	return (
		!!theme.bio ||
		!!theme.backgroundUrl ||
		!!theme.musicUrl ||
		!!theme.cursorUrl ||
		translatorLinks.length > 0
	);
}
