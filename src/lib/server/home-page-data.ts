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
import { getExtensionReleaseDownloadUrls } from '$lib/server/extension-release-downloads';
import { listHomeExtensionMockupGames } from '$lib/server/home-extension-mockup-games';
import { listRoleBadgeStylesMap } from '$lib/server/role-badge-styles';
import { listStaffUsersForHome } from '$lib/server/staff-users';
import { tradVerIndicatesIntegrated } from '$lib/server/translation-notify-rules';
import { pickTranslationForUpdate } from '$lib/updates/pick-update-translation';
import { profilePublicHref } from '$lib/utils/profile-url';
import { desc, eq } from 'drizzle-orm';

export const HOME_CACHE_TTL_MS = 60_000;
export const HOME_CACHE_CONTROL = `public, max-age=${HOME_CACHE_TTL_MS / 1000}, stale-while-revalidate=120`;

export type HomePayload = {
	updates: {
		updateId: string;
		updateStatus: string | null;
		updateCreatedAt: Date;
		game: {
			gameId: string;
			name: string | null;
			gameLink: string | null;
			gameImage: string | null;
			gameWebsite: string | null;
			gameVersion: string | null;
			gameEngineTypes: string[];
			hasTranslation: boolean;
			tversion: string | null;
			referenceVersion: string | null;
			isOutdated: boolean;
			isIntegrated: boolean;
		};
	}[];
	team: {
		teamId: string;
		teamName: string;
		teamImage: string | null;
		teamRole: string;
		teamRoleSlug: string;
		teamBadgeStyle: string;
		teamLink: string;
	}[];
	extensionMockupGames: Awaited<ReturnType<typeof listHomeExtensionMockupGames>>;
	extensionDownloads: Awaited<ReturnType<typeof getExtensionReleaseDownloadUrls>>;
	error: string | null;
};

let homeCache: { expiresAt: number; payload: HomePayload } | null = null;
let inFlight: Promise<HomePayload> | null = null;

async function buildHomePayload(): Promise<HomePayload> {
	const listWhere = await buildUpdatesListWhere('featured');
	const [flat, staffUsers, roleBadgeStyles, extensionMockupGames, extensionDownloads] =
		await Promise.all([
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
			listStaffUsersForHome(),
			listRoleBadgeStylesMap(),
			listHomeExtensionMockupGames(5),
			getExtensionReleaseDownloadUrls()
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
		extensionMockupGames,
		extensionDownloads,
		error: null
	};
}

/**
 * Payload de la page d’accueil avec cache mémoire (TTL court).
 * Coalesce les requêtes concurrentes pour éviter le « thundering herd » au démarrage.
 */
export async function getHomePayload(): Promise<HomePayload> {
	const now = Date.now();
	if (homeCache && homeCache.expiresAt > now) {
		return homeCache.payload;
	}

	if (inFlight) return inFlight;

	inFlight = buildHomePayload()
		.then((payload) => {
			homeCache = { expiresAt: Date.now() + HOME_CACHE_TTL_MS, payload };
			return payload;
		})
		.finally(() => {
			inFlight = null;
		});

	return inFlight;
}

/** Préchauffe le cache au démarrage du serveur (hook `init`). N’échoue jamais. */
export async function warmHomePayload(): Promise<void> {
	try {
		await getHomePayload();
	} catch (error) {
		console.warn('warmHomePayload:', error);
	}
}
