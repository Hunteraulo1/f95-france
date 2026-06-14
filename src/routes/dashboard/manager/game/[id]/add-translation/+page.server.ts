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
import { asc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	await assertGameManageAccess(locals);
	if (locals.user?.role) {
		await assertRoleEditMode(locals.user.role);
	}

	const gameId = params.id;
	if (!gameId) throw error(400, 'ID du jeu requis');

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

		const firstTranslation = await db
			.select({ gameType: table.gameTranslation.gameType })
			.from(table.gameTranslation)
			.where(eq(table.gameTranslation.gameId, gameId))
			.orderBy(asc(table.gameTranslation.createdAt))
			.limit(1);

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
			defaultGameType: firstTranslation[0]?.gameType ?? 'other',
			translators,
			addContributorMode,
			warnUnknownTranslators,
			canManageGameAutoCheck: hasPermission(locals, 'games.auto_check'),
			canUseSilentMode: hasPermission(locals, 'games.silent_mode'),
			hasGamesManage,
			user: locals.user
		};
	} catch (err) {
		if (isHttpError(err)) throw err;
		appLogError('system', 'Chargement page add-translation échoué', err);
		throw error(500, 'Erreur serveur');
	}
};
