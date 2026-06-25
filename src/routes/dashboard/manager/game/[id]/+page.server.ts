import type { AddTranslatorMode } from '$lib/components/dashboard/add-translator-mode';
import { appLogError } from '$lib/server/app-log-bridge';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { assertGameManageAccess } from '$lib/server/game-manage-guard';
import { listGameUpdateHistoryPage } from '$lib/server/game-update-history-query';
import { hasPermission } from '$lib/server/permissions';
import {
	assertRoleEditMode,
	getRoleEditMode,
	resolveShouldCreateSubmissionForUser
} from '$lib/server/role-edit-mode';
import { hasSubmissionOpenedByUserIdColumn } from '$lib/server/submission-opened-by-compat';
import { submissionOpenedByUser } from '$lib/server/submission-users';
import { error, isHttpError } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	await assertGameManageAccess(locals);
	if (locals.user?.role) {
		await assertRoleEditMode(locals.user.role);
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
				descriptionFr: table.game.descriptionFr,
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

		const role = locals.user?.role;
		const directModeActive = locals.user?.directMode ?? true;
		const hasGamesManage = hasPermission(locals, 'games.manage');
		const roleEditMode = hasGamesManage && role ? await getRoleEditMode(role) : null;
		const usesSubmission = locals.user
			? await resolveShouldCreateSubmissionForUser({
					roleSlug: role ?? 'user',
					userDirectMode: directModeActive
				})
			: true;
		const warnUnknownTranslators =
			hasGamesManage &&
			(roleEditMode === 'direct' || (roleEditMode === 'user_direct_mode' && directModeActive));
		let addContributorMode: AddTranslatorMode | false = false;
		if (role === 'translator' || usesSubmission) {
			addContributorMode = 'submission';
		} else if (hasGamesManage) {
			addContributorMode = warnUnknownTranslators ? 'direct' : 'submission';
		}

		const canViewUpdateHistory = hasPermission(locals, 'games.view_history');
		const canRevertUpdateHistory = hasPermission(locals, 'games.revert_history') && !usesSubmission;

		const updateHistoryPage = canViewUpdateHistory
			? await listGameUpdateHistoryPage(gameId, 1)
			: { entries: [], totalCount: 0, page: 1, totalPages: 1, pageSize: 15 };

		return {
			game: game[0],
			translations,
			translators,
			pendingSubmissions,
			updateHistoryPage,
			canViewUpdateHistory,
			canRevertUpdateHistory,
			user: locals.user,
			canManageGameAutoCheck: hasPermission(locals, 'games.auto_check'),
			canUseSilentMode: hasPermission(locals, 'games.silent_mode'),
			canReviewSubmissions: hasPermission(locals, 'submissions.review'),
			canShowInternalIds: hasPermission(locals, 'content.view_ids'),
			addContributorMode
		};
	} catch (err) {
		if (isHttpError(err)) {
			throw err;
		}
		appLogError('system', 'Récupération jeu page dashboard échouée', err);
		throw error(500, 'Erreur serveur');
	}
};
