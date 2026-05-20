import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { hasSubmissionOpenedByUserIdColumn } from '$lib/server/submission-opened-by-compat';
import { submissionOpenedByUser } from '$lib/server/submission-users';
import { error, isHttpError } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		throw error(401, 'Non authentifié');
	}

	const gameId = params.id;

	if (!gameId) {
		throw error(400, 'ID du jeu requis');
	}

	try {
		// Récupérer le jeu avec ses traductions
		const game = await db
			.select({
				id: table.game.id,
				name: table.game.name,
				description: table.game.description,
				website: table.game.website,
				threadId: table.game.threadId,
				link: table.game.link,
				tags: table.game.tags,
				image: table.game.image,
				gameAutoCheck: table.game.gameAutoCheck,
				gameVersion: table.game.gameVersion,
				createdAt: table.game.createdAt,
				updatedAt: table.game.updatedAt
			})
			.from(table.game)
			.where(eq(table.game.id, gameId))
			.limit(1);

		if (game.length === 0) {
			throw error(404, 'Jeu non trouvé');
		}

		// Récupérer les traductions du jeu
		const translations = await db
			.select({
				id: table.gameTranslation.id,
				translationName: table.gameTranslation.translationName,
				version: table.gameTranslation.version,
				status: table.gameTranslation.status,
				tversion: table.gameTranslation.tversion,
				tlink: table.gameTranslation.tlink,
				translatorId: table.gameTranslation.translatorId,
				proofreaderId: table.gameTranslation.proofreaderId,
				ttype: table.gameTranslation.ttype,
				tname: table.gameTranslation.tname,
				gameType: table.gameTranslation.gameType,
				ac: table.gameTranslation.ac,
				createdAt: table.gameTranslation.createdAt,
				updatedAt: table.gameTranslation.updatedAt
			})
			.from(table.gameTranslation)
			.where(eq(table.gameTranslation.gameId, gameId))
			.orderBy(asc(table.gameTranslation.createdAt));

		const translators = await db
			.select({
				id: table.translator.id,
				name: table.translator.name,
				userId: table.translator.userId,
				username: table.user.username
			})
			.from(table.translator)
			.leftJoin(table.user, eq(table.user.id, table.translator.userId))
			.orderBy(asc(table.translator.name));

		// Soumissions actives (en attente / ouvertes) liées au jeu ou à ses traductions.
		const translationIds = translations.map((t) => t.id);
		const submissionWhere = and(
			sql`${table.submission.status} IN ('pending', 'opened')`,
			translationIds.length > 0
				? or(
						eq(table.submission.gameId, gameId),
						inArray(table.submission.translationId, translationIds)
					)
				: eq(table.submission.gameId, gameId)
		);
		const hasOpenedBy = await hasSubmissionOpenedByUserIdColumn();
		const pendingSubmissions = hasOpenedBy
			? await db
					.select({
						id: table.submission.id,
						type: table.submission.type,
						status: table.submission.status,
						translationId: table.submission.translationId,
						createdAt: table.submission.createdAt,
						userId: table.submission.userId,
						username: table.user.username,
						openedByUsername: submissionOpenedByUser.username
					})
					.from(table.submission)
					.leftJoin(table.user, eq(table.user.id, table.submission.userId))
					.leftJoin(
						submissionOpenedByUser,
						eq(submissionOpenedByUser.id, table.submission.openedByUserId)
					)
					.where(submissionWhere)
					.orderBy(desc(table.submission.createdAt))
			: await db
					.select({
						id: table.submission.id,
						type: table.submission.type,
						status: table.submission.status,
						translationId: table.submission.translationId,
						createdAt: table.submission.createdAt,
						userId: table.submission.userId,
						username: table.user.username,
						openedByUsername: sql<string | null>`NULL`.as('openedByUsername')
					})
					.from(table.submission)
					.leftJoin(table.user, eq(table.user.id, table.submission.userId))
					.where(submissionWhere)
					.orderBy(desc(table.submission.createdAt));

		return {
			game: game[0],
			translations,
			translators,
			pendingSubmissions,
			user: locals.user
		};
	} catch (err) {
		if (isHttpError(err)) {
			throw err;
		}
		console.error('Erreur lors de la récupération du jeu:', err);
		throw error(500, 'Erreur serveur');
	}
};
