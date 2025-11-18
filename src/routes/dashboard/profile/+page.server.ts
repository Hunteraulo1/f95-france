import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return {
			stats: null
		};
	}

	const userId = locals.user.id;

	// Compter les soumissions acceptées par type
	let gameAddSubmissions = 0;
	let gameEditSubmissions = 0;
	let submissionAdd = 0;
	let submissionEdit = 0;

	try {
		// Jeux ajoutés via soumissions acceptées
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

		// Jeux modifiés via soumissions acceptées
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

		// Soumissions ajoutées (nouvelles traductions ou nouveaux jeux)
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

		// Soumissions modifiées (mises à jour ou suppressions)
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
		stats: {
			gameAdd: gameAddSubmissions,
			gameEdit: gameEditSubmissions,
			submissionAdd,
			submissionEdit
		}
	};
};
