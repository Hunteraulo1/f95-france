import type { AddTranslatorMode } from '$lib/components/dashboard/add-translator-mode';
import { appLogError } from '$lib/server/app-log-bridge';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { assertGameManageAccess } from '$lib/server/game-manage-guard';
import { hasPermission } from '$lib/server/permissions';
import {
	assertRoleEditMode,
	getRoleEditMode,
	resolveShouldCreateSubmissionForUser
} from '$lib/server/role-edit-mode';
import { error, isHttpError } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	await assertGameManageAccess(locals);
	if (locals.user?.role) {
		await assertRoleEditMode(locals.user.role);
	}

	const { id: gameId, translationId } = params;
	if (!gameId || !translationId) throw error(400, 'IDs requis');

	try {
		const gameRows = await db
			.select({
				id: table.game.id,
				name: table.game.name,
				website: table.game.website,
				gameAutoCheck: table.game.gameAutoCheck,
				gameVersion: table.game.gameVersion,
				image: table.game.image
			})
			.from(table.game)
			.where(eq(table.game.id, gameId))
			.limit(1);

		if (gameRows.length === 0) throw error(404, 'Jeu non trouvé');

		const translationRows = await db
			.select({
				id: table.gameTranslation.id,
				translationName: table.gameTranslation.translationName,
				version: table.gameTranslation.version,
				tversion: table.gameTranslation.tversion,
				status: table.gameTranslation.status,
				ttype: table.gameTranslation.ttype,
				tlink: table.gameTranslation.tlink,
				tname: table.gameTranslation.tname,
				gameType: table.gameTranslation.gameType,
				ac: table.gameTranslation.ac,
				translatorId: table.gameTranslation.translatorId,
				proofreaderId: table.gameTranslation.proofreaderId
			})
			.from(table.gameTranslation)
			.where(
				and(
					eq(table.gameTranslation.id, translationId),
					eq(table.gameTranslation.gameId, gameId)
				)
			)
			.limit(1);

		if (translationRows.length === 0) throw error(404, 'Traduction non trouvée');

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

		return {
			game: gameRows[0],
			translation: translationRows[0],
			translators,
			addContributorMode,
			warnUnknownTranslators,
			canManageGameAutoCheck: hasPermission(locals, 'games.auto_check'),
			canUseSilentMode: hasPermission(locals, 'games.silent_mode')
		};
	} catch (err) {
		if (isHttpError(err)) throw err;
		appLogError('system', 'Chargement page edit-translation échoué', err);
		throw error(500, 'Erreur serveur');
	}
};
