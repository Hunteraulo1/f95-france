import { hasEffectivePermission } from '$lib/permissions/effective';
import {
	buildCustomProfileTheme,
	normalizeProfileBio,
	validateOptionalHttpUrl
} from '$lib/profile/custom-profile';
import { loadProfileStats } from '$lib/server/profile-stats';
import { validateOptionalYoutubeMusicUrl } from '$lib/profile/youtube-music';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { assertPermission } from '$lib/server/permissions-guard';
import {
	loadProfileTranslationsForUser,
	PROFILE_TRANSLATIONS_PAGE_SIZE
} from '$lib/server/profile-translations';
import { loadTranslatorPagesForUser } from '$lib/server/profile-translator';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const userProfileSelect = {
	id: table.user.id,
	username: table.user.username,
	discordId: table.user.discordId,
	email: table.user.email,
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

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		return {
			user: null,
			profileStats: null,
			canCustomizeProfile: false,
			customProfile: null,
			translatorLinks: [],
			linkedTranslator: null,
			translations: [],
			translationsTotal: 0,
			translationsPage: 1,
			translationsPageSize: PROFILE_TRANSLATIONS_PAGE_SIZE,
			translationsTotalPages: 1
		};
	}

	const userId = locals.user.id;
	const user = await db
		.select(userProfileSelect)
		.from(table.user)
		.where(eq(table.user.id, userId))
		.limit(1);

	const row = user[0] ?? null;
	const canCustomizeProfile = hasEffectivePermission(
		locals.user.role,
		locals.permissions,
		'profile.customize'
	);

	const [{ translator, links }, translationBundle, profileStats] = await Promise.all([
		loadTranslatorPagesForUser(userId),
		loadProfileTranslationsForUser(userId, { page: parseTranslationsPage(url) }),
		loadProfileStats(userId)
	]);

	return {
		user: row,
		profileStats,
		canCustomizeProfile,
		customProfile: row ? buildCustomProfileTheme(row) : null,
		translatorLinks: links,
		linkedTranslator: translator ?? translationBundle.linkedTranslator,
		translations: translationBundle.translations,
		translationsTotal: translationBundle.totalCount,
		translationsPage: translationBundle.page,
		translationsPageSize: translationBundle.pageSize,
		translationsTotalPages: translationBundle.totalPages
	};
};

export const actions: Actions = {
	updateCustomProfile: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}
		await assertPermission(locals, 'profile.customize');

		const formData = await request.formData();
		const bio = normalizeProfileBio(String(formData.get('profileBio') ?? ''));

		const background = validateOptionalHttpUrl(
			String(formData.get('profileBackgroundUrl') ?? ''),
			'Image de fond'
		);
		if (typeof background === 'object' && background && 'error' in background) {
			return fail(400, { message: background.error });
		}

		const music = validateOptionalYoutubeMusicUrl(String(formData.get('profileMusicUrl') ?? ''));
		if (typeof music === 'object' && music && 'error' in music) {
			return fail(400, { message: music.error });
		}

		const cursor = validateOptionalHttpUrl(
			String(formData.get('profileCursorUrl') ?? ''),
			'Curseur'
		);
		if (typeof cursor === 'object' && cursor && 'error' in cursor) {
			return fail(400, { message: cursor.error });
		}

		try {
			await db
				.update(table.user)
				.set({
					profileBio: bio || null,
					profileBackgroundUrl: background,
					profileMusicUrl: music,
					profileCursorUrl: cursor,
					updatedAt: new Date()
				})
				.where(eq(table.user.id, locals.user.id));

			return { success: true, message: 'Profil personnalisé mis à jour.' };
		} catch (error: unknown) {
			console.error('Erreur mise à jour profil personnalisé:', error);
			return fail(500, { message: 'Erreur lors de la mise à jour du profil.' });
		}
	}
};
