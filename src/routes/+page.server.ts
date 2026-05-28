import { resolveRoleBadgeStyle } from '$lib/permissions/role-badge-style';
import { embeddedGameFromRow } from '$lib/server/api/updates-embedded-game';
import { db } from '$lib/server/db';
import { enginesPerGameSubquery } from '$lib/server/db/engines-per-game-subquery';
import { game, update as updateTable } from '$lib/server/db/schema';
import { listRoleBadgeStylesMap } from '$lib/server/role-badge-styles';
import { listStaffUsers } from '$lib/server/staff-users';
import { profilePublicHref } from '$lib/utils/profile-url';
import { desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	try {
		const [flat, staffUsers, roleBadgeStyles] = await Promise.all([
			db
				.select({
					updateId: updateTable.id,
					updateStatus: updateTable.status,
					updateCreatedAt: updateTable.createdAt,
					gameId: game.id,
					gameName: game.name,
					gameImage: game.image,
					gameLink: game.link,
					gameWebsite: game.website,
					gameThreadId: game.threadId,
					gameGameVersion: game.gameVersion,
					gameEngineTypes: enginesPerGameSubquery.engineTypes,
					gameTags: game.tags
				})
				.from(updateTable)
				.innerJoin(game, eq(updateTable.gameId, game.id))
				.leftJoin(enginesPerGameSubquery, eq(game.id, enginesPerGameSubquery.gameId))
				.orderBy(desc(updateTable.createdAt))
				.limit(4),
			listStaffUsers(),
			listRoleBadgeStylesMap()
		]);

		const updates = flat.map((row) => {
			const embedded = embeddedGameFromRow(row);
			return {
				updateId: row.updateId,
				updateStatus: row.updateStatus,
				updateCreatedAt: row.updateCreatedAt,
				game: {
					name: embedded.name,
					gameLink: embedded.link,
					gameImage: embedded.image,
					gameWebsite: embedded.website,
					gameVersion: embedded.gameVersion,
					gameEngineTypes: embedded.engineTypes.map((value) => String(value))
				}
			};
		});

		const team = staffUsers.map((member) => ({
			teamId: member.id,
			teamName: member.username,
			teamImage: member.avatar,
			teamRole: member.roleLabel,
			teamRoleSlug: member.role,
			teamBadgeStyle:
				roleBadgeStyles[member.role] ?? resolveRoleBadgeStyle(member.role, member.badgeStyle),
			teamLink: profilePublicHref(member.username)
		}));

		return {
			updates,
			team,
			error: null as string | null
		};
	} catch (error) {
		console.error('Erreur chargement accueil:', error);
		return {
			updates: [],
			team: [],
			error: 'Impossible de charger les mises a jour pour le moment.'
		};
	}
};
