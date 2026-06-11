import type { PublicGamesListParams } from '$lib/games/games-filter-url';
import { splitGameTags } from '$lib/games/public-game-display';
import { PUBLIC_GAMES_SORT_OPTIONS, type PublicGamesSort } from '$lib/games/public-games-query';
import type { GameTranslationRow } from '$lib/server/api/games-with-translations';
import { translationsByGameIds } from '$lib/server/api/games-with-translations';
import { countUpToDateTranslations } from '$lib/server/api/translation-public';
import { db } from '$lib/server/db';
import { enginesPerGameSubquery, parseEngineTypes } from '$lib/server/db/engines-per-game-subquery';
import { game } from '$lib/server/db/schema';
import {
	buildGameCatalogFilterParts,
	combineSqlParts,
	type GameCatalogFilters
} from '$lib/server/game-catalog-filter-sql';
import { resolveGameThreadLink } from '$lib/utils/game-thread-link';
import { getTranslationProgressLabel } from '$lib/utils/game-translation-labels';
import { asc, count, desc, eq } from 'drizzle-orm';

export {
	buildPublicGamesListSearchParams,
	hasActivePublicGamesListFilters,
	parsePublicGamesListParams
} from '$lib/games/games-filter-url';

export const PUBLIC_GAMES_PAGE_SIZE = 24;

export { PUBLIC_GAMES_SORT_OPTIONS };
export type { PublicGamesListParams, PublicGamesSort };

export type PublicGameListItem = {
	id: string;
	name: string;
	image: string;
	link: string;
	website: string;
	gameVersion: string | null;
	engineTypes: string[];
	updatedAt: Date;
	translationCount: number;
	upToDateTranslationCount: number;
	translationStatus: string | null;
	translationStatusLabel: string | null;
	tags: string[];
};

function pickPrimaryTranslation(translations: GameTranslationRow[]): GameTranslationRow | null {
	if (translations.length === 0) return null;
	const vf = translations.find((t) => t.ttype === 'vf');
	if (vf) return vf;
	const completed = translations.find((t) => t.status === 'completed');
	if (completed) return completed;
	return translations[0];
}

function buildWhereClause(params: PublicGamesListParams) {
	return combineSqlParts(
		buildGameCatalogFilterParts(params.filters as GameCatalogFilters, params.query)
	);
}

function buildOrderBy(sort: PublicGamesSort) {
	switch (sort) {
		case 'name_asc':
			return asc(game.name);
		case 'name_desc':
			return desc(game.name);
		case 'updated_asc':
			return asc(game.updatedAt);
		case 'updated_desc':
		default:
			return desc(game.updatedAt);
	}
}

export async function listPublicGames(params: PublicGamesListParams) {
	const page = Math.max(1, params.page);
	const where = buildWhereClause(params);

	const [{ total: totalRaw }] = await db.select({ total: count() }).from(game).where(where);
	const total = Number(totalRaw ?? 0);
	const totalPages = Math.max(1, Math.ceil(total / PUBLIC_GAMES_PAGE_SIZE));
	const safePage = Math.min(page, totalPages);
	const offset = (safePage - 1) * PUBLIC_GAMES_PAGE_SIZE;

	const enginesSq = enginesPerGameSubquery();
	const rows = await db
		.select({
			id: game.id,
			name: game.name,
			image: game.image,
			link: game.link,
			threadId: game.threadId,
			website: game.website,
			gameVersion: game.gameVersion,
			updatedAt: game.updatedAt,
			tags: game.tags,
			engineTypes: enginesSq.engineTypes
		})
		.from(game)
		.leftJoin(enginesSq, eq(game.id, enginesSq.gameId))
		.where(where)
		.orderBy(buildOrderBy(params.sort))
		.limit(PUBLIC_GAMES_PAGE_SIZE)
		.offset(offset);

	const byGame = await translationsByGameIds(rows.map((r) => r.id));

	const games: PublicGameListItem[] = rows.map((row) => {
		const translations = byGame.get(row.id) ?? [];
		const primary = pickPrimaryTranslation(translations);
		const gameVersion = row.gameVersion?.trim() || null;
		return {
			id: row.id,
			name: row.name,
			image: row.image,
			link:
				resolveGameThreadLink({
					link: row.link,
					threadId: row.threadId,
					website: row.website
				}) ?? '',
			website: row.website,
			gameVersion: row.gameVersion,
			engineTypes: parseEngineTypes(row.engineTypes),
			updatedAt: row.updatedAt,
			translationCount: translations.length,
			upToDateTranslationCount: countUpToDateTranslations(translations, gameVersion),
			translationStatus: primary?.status ?? null,
			translationStatusLabel: primary ? getTranslationProgressLabel(primary.status) : null,
			tags: splitGameTags(row.tags)
		};
	});

	return {
		games,
		total,
		page: safePage,
		pageSize: PUBLIC_GAMES_PAGE_SIZE,
		totalPages,
		query: params.query,
		sort: params.sort,
		filters: params.filters
	};
}
