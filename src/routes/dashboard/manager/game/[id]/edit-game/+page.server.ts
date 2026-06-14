import { appLogError } from '$lib/server/app-log-bridge';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { assertGameManageAccess } from '$lib/server/game-manage-guard';
import { hasPermission } from '$lib/server/permissions';
import { assertRoleEditMode } from '$lib/server/role-edit-mode';
import { error, isHttpError } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	await assertGameManageAccess(locals);
	if (locals.user?.role) {
		await assertRoleEditMode(locals.user.role);
	}

	const gameId = params.id;
	if (!gameId) throw error(400, 'ID du jeu requis');

	try {
		const rows = await db
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

		if (rows.length === 0) throw error(404, 'Jeu non trouvé');

		return {
			game: rows[0],
			canManageGameAutoCheck: hasPermission(locals, 'games.auto_check'),
			canUseSilentMode: hasPermission(locals, 'games.silent_mode')
		};
	} catch (err) {
		if (isHttpError(err)) throw err;
		appLogError('system', 'Chargement page edit-game échoué', err);
		throw error(500, 'Erreur serveur');
	}
};
