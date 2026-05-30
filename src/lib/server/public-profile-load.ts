import { buildCustomProfileTheme, hasCustomProfilePresentation } from '$lib/profile/custom-profile';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { loadProfileStats } from '$lib/server/profile-stats';
import { loadProfileTranslationsForUser } from '$lib/server/profile-translations';
import { loadTranslatorPagesForUser } from '$lib/server/profile-translator';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

const userProfileSelect = {
	id: table.user.id,
	username: table.user.username,
	discordId: table.user.discordId,
	avatar: table.user.avatar,
	role: table.user.role,
	directMode: table.user.directMode,
	profileBio: table.user.profileBio,
	profileBackgroundUrl: table.user.profileBackgroundUrl,
	profileMusicUrl: table.user.profileMusicUrl,
	profileCursorUrl: table.user.profileCursorUrl,
	createdAt: table.user.createdAt,
	updatedAt: table.user.updatedAt
} as const;

function parseTranslationsPage(url: URL): number {
	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	return Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
}

export function profilePublicPath(username: string, search = ''): string {
	const base = `/profile/${encodeURIComponent(username.trim())}`;
	if (!search) return base;
	return search.startsWith('?') ? `${base}${search}` : `${base}?${search}`;
}

/** Charge les données d’un profil public (pseudo ou id utilisateur). */
export async function loadPublicProfile(options: {
	profileRef: string;
	url: URL;
	viewerUserId?: string | null;
}) {
	const profileRef = String(options.profileRef ?? '').trim();

	const userByUsername = await db
		.select(userProfileSelect)
		.from(table.user)
		.where(eq(table.user.username, profileRef))
		.limit(1);

	const lookedUpByUserId = userByUsername.length === 0;

	const user = lookedUpByUserId
		? await db
				.select(userProfileSelect)
				.from(table.user)
				.where(eq(table.user.id, profileRef))
				.limit(1)
		: userByUsername;

	if (user.length === 0) {
		throw error(404, 'Utilisateur non trouvé');
	}

	const userId = user[0].id;
	const row = user[0];

	const theme = buildCustomProfileTheme(row);
	const [{ translator, links }, translationBundle, profileStats] = await Promise.all([
		loadTranslatorPagesForUser(userId),
		loadProfileTranslationsForUser(userId, { page: parseTranslationsPage(options.url) }),
		loadProfileStats(userId)
	]);

	const isOwnProfile = options.viewerUserId === userId;

	return {
		user: row,
		profileStats,
		customProfile: hasCustomProfilePresentation(theme, links) ? theme : null,
		translatorLinks: links,
		linkedTranslator: translator ?? translationBundle.linkedTranslator,
		translations: translationBundle.translations,
		translationsTotal: translationBundle.totalCount,
		translationsPage: translationBundle.page,
		translationsPageSize: translationBundle.pageSize,
		translationsTotalPages: translationBundle.totalPages,
		profileSlug: row.username,
		lookedUpByUserId,
		profileRef,
		isOwnProfile,
		editProfileHref: isOwnProfile ? '/dashboard/profile' : null
	};
}
