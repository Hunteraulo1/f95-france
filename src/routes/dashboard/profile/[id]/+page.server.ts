import { buildCustomProfileTheme, hasCustomProfilePresentation } from '$lib/profile/custom-profile';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { loadProfileStats } from '$lib/server/profile-stats';
import { loadProfileTranslationsForUser } from '$lib/server/profile-translations';
import { loadTranslatorPagesForUser } from '$lib/server/profile-translator';
import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

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

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const profileRef = String(params.id ?? '').trim();

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

	if (lookedUpByUserId && profileRef !== row.username) {
		const canonical = `/dashboard/profile/${encodeURIComponent(row.username)}`;
		throw redirect(301, url.search ? `${canonical}${url.search}` : canonical);
	}

	const theme = buildCustomProfileTheme(row);
	const [{ translator, links }, translationBundle, profileStats] = await Promise.all([
		loadTranslatorPagesForUser(userId),
		loadProfileTranslationsForUser(userId, { page: parseTranslationsPage(url) }),
		loadProfileStats(userId)
	]);

	const isOwnProfile = locals.user?.id === userId;

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
		isOwnProfile,
		editProfileHref: isOwnProfile ? '/dashboard/profile' : null
	};
};
