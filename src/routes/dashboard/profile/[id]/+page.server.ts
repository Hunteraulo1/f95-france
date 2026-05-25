import { buildCustomProfileTheme, hasCustomProfilePresentation } from '$lib/profile/custom-profile';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { loadProfileTranslationsForUser } from '$lib/server/profile-translations';
import { loadTranslatorPagesForUser } from '$lib/server/profile-translator';
import { error } from '@sveltejs/kit';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

const userProfileSelect = {
	id: table.user.id,
	username: table.user.username,
	discordId: table.user.discordId,
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

export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;
	const profileRef = String(id ?? '').trim();

	const userByUsername = await db
		.select(userProfileSelect)
		.from(table.user)
		.where(eq(table.user.username, profileRef))
		.limit(1);

	const user =
		userByUsername.length > 0
			? userByUsername
			: await db
					.select(userProfileSelect)
					.from(table.user)
					.where(eq(table.user.id, profileRef))
					.limit(1);

	if (user.length === 0) {
		throw error(404, 'Utilisateur non trouvé');
	}
	const userId = user[0].id;
	const row = user[0];

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
	} catch (err: unknown) {
		console.warn('Erreur lors du chargement des statistiques de soumissions:', err);
	}

	const theme = buildCustomProfileTheme(row);
	const [{ translator, links }, translationBundle] = await Promise.all([
		loadTranslatorPagesForUser(userId),
		loadProfileTranslationsForUser(userId)
	]);

	return {
		user: row,
		stats: {
			gameAdd: gameAddSubmissions,
			gameEdit: gameEditSubmissions,
			submissionAdd,
			submissionEdit
		},
		customProfile: hasCustomProfilePresentation(theme, links) ? theme : null,
		translatorLinks: links,
		linkedTranslator: translator ?? translationBundle.linkedTranslator,
		translations: translationBundle.translations,
		translationsTotal: translationBundle.totalCount,
		allTranslationsHref: null
	};
};
