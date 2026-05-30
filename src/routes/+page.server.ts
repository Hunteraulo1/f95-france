import { resolveRoleBadgeStyle } from '$lib/permissions/role-badge-style';
import { translationsByGameIds } from '$lib/server/api/games-with-translations';
import {
	effectiveTranslationVersion,
	isTranslationOutdated
} from '$lib/server/api/translation-public';
import { embeddedGameFromRow } from '$lib/server/api/updates-embedded-game';
import { buildUpdatesListWhere } from '$lib/server/api/updates-scope-query';
import { db } from '$lib/server/db';
import { enginesPerGameSubquery } from '$lib/server/db/engines-per-game-subquery';
import { game, update as updateTable } from '$lib/server/db/schema';
import { listRoleBadgeStylesMap } from '$lib/server/role-badge-styles';
import { listStaffUsers } from '$lib/server/staff-users';
import { tradVerIndicatesIntegrated } from '$lib/server/translation-notify-rules';
import { pickTranslationForUpdate } from '$lib/updates/pick-update-translation';
import { profilePublicHref } from '$lib/utils/profile-url';
import { desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	try {
		const listWhere = await buildUpdatesListWhere('featured');
		const [flat, staffUsers, roleBadgeStyles] = await Promise.all([
			(() => {
				const enginesSq = enginesPerGameSubquery();
				const q = db
					.select({
						updateId: updateTable.id,
						updateStatus: updateTable.status,
						updateCreatedAt: updateTable.createdAt,
						updateUpdatedAt: updateTable.updatedAt,
						gameId: game.id,
						gameName: game.name,
						gameImage: game.image,
						gameLink: game.link,
						gameWebsite: game.website,
						gameThreadId: game.threadId,
						gameGameVersion: game.gameVersion,
						gameEngineTypes: enginesSq.engineTypes,
						gameTags: game.tags
					})
					.from(updateTable)
					.innerJoin(game, eq(updateTable.gameId, game.id))
					.leftJoin(enginesSq, eq(game.id, enginesSq.gameId))
					.orderBy(desc(updateTable.createdAt))
					.limit(4);
				return listWhere ? q.where(listWhere) : q;
			})(),
			listStaffUsers(),
			listRoleBadgeStylesMap()
		]);

		const byGame = await translationsByGameIds(flat.map((row) => row.gameId));

		const updates = flat.map((row) => {
			const embedded = embeddedGameFromRow(row);
			const translations = byGame.get(row.gameId) ?? [];
			const translation = pickTranslationForUpdate(
				{
					status: row.updateStatus,
					createdAt: row.updateCreatedAt,
					updatedAt: row.updateUpdatedAt
				},
				translations
			);
			const gameVersion = embedded.gameVersion?.trim() || null;
			const tversion = translation?.tversion?.trim() || null;
			const referenceVersion = translation
				? effectiveTranslationVersion(translation.version, gameVersion)
				: gameVersion;
			const isIntegrated = translation
				? tradVerIndicatesIntegrated(translation.tversion, translation.tname)
				: false;
			const isOutdated = translation
				? isTranslationOutdated(
						{
							version: translation.version,
							tversion: translation.tversion,
							tname: translation.tname
						},
						gameVersion
					)
				: false;

			return {
				updateId: row.updateId,
				updateStatus: row.updateStatus,
				updateCreatedAt: row.updateCreatedAt,
				game: {
					gameId: embedded.id,
					name: embedded.name,
					gameLink: embedded.link,
					gameImage: embedded.image,
					gameWebsite: embedded.website,
					gameVersion,
					gameEngineTypes: embedded.engineTypes.map((value) => String(value)),
					hasTranslation: translation !== null,
					tversion,
					referenceVersion,
					isOutdated,
					isIntegrated
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
