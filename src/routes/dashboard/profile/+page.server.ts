import { hasEffectivePermission } from '$lib/permissions/effective';
import {
	buildCustomProfileTheme,
	normalizeProfileBio,
	validateOptionalHttpUrl
} from '$lib/profile/custom-profile';
import { validateOptionalYoutubeMusicUrl } from '$lib/profile/youtube-music';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { assertPermission } from '$lib/server/permissions-guard';
import { loadProfileTranslationsForUser } from '$lib/server/profile-translations';
import { loadTranslatorPagesForUser } from '$lib/server/profile-translator';
import { fail } from '@sveltejs/kit';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const userProfileSelect = {
	id: table.user.id,
	username: table.user.username,
	discordId: table.user.discordId,
	email: table.user.email,
	avatar: table.user.avatar,
	role: table.user.role,
	directMode: table.user.directMode,
	gameAdd: table.user.gameAdd,
	gameEdit: table.user.gameEdit,
	profileBio: table.user.profileBio,
	profileBackgroundUrl: table.user.profileBackgroundUrl,
	profileMusicUrl: table.user.profileMusicUrl,
	profileCursorUrl: table.user.profileCursorUrl,
	createdAt: table.user.createdAt,
	updatedAt: table.user.updatedAt
} as const;

async function loadSubmissionStats(userId: string) {
	let gameAddSubmissions = 0;
	let gameEditSubmissions = 0;
	let submissionAdd = 0;
	let submissionEdit = 0;

	try {
		const gameAddResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(
				and(
					eq(table.submission.userId, userId),
					eq(table.submission.status, 'accepted'),
					eq(table.submission.type, 'game')
				)
			);
		gameAddSubmissions = gameAddResult[0]?.count || 0;

		const gameEditResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(
				and(
					eq(table.submission.userId, userId),
					eq(table.submission.status, 'accepted'),
					eq(table.submission.type, 'update')
				)
			);
		gameEditSubmissions = gameEditResult[0]?.count || 0;

		const submissionAddResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(
				and(
					eq(table.submission.userId, userId),
					eq(table.submission.status, 'accepted'),
					inArray(table.submission.type, ['game', 'translation'])
				)
			);
		submissionAdd = submissionAddResult[0]?.count || 0;

		const submissionEditResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(
				and(
					eq(table.submission.userId, userId),
					eq(table.submission.status, 'accepted'),
					inArray(table.submission.type, ['update', 'delete'])
				)
			);
		submissionEdit = submissionEditResult[0]?.count || 0;
	} catch (error: unknown) {
		console.warn('Erreur lors du chargement des statistiques de soumissions:', error);
	}

	return {
		gameAdd: gameAddSubmissions,
		gameEdit: gameEditSubmissions,
		submissionAdd,
		submissionEdit
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return {
			user: null,
			stats: null,
			canCustomizeProfile: false,
			customProfile: null,
			translatorLinks: [],
			linkedTranslator: null,
			translations: [],
			translationsTotal: 0,
			allTranslationsHref: null
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
	const [{ translator, links }, translationBundle] = await Promise.all([
		loadTranslatorPagesForUser(userId),
		loadProfileTranslationsForUser(userId)
	]);

	return {
		user: row,
		stats: await loadSubmissionStats(userId),
		canCustomizeProfile,
		customProfile: row ? buildCustomProfileTheme(row) : null,
		translatorLinks: links,
		linkedTranslator: translator ?? translationBundle.linkedTranslator,
		translations: translationBundle.translations,
		translationsTotal: translationBundle.totalCount,
		allTranslationsHref: '/dashboard/my-translations'
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
