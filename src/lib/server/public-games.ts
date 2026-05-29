import type { FilterSelection, PublicGamesListParams } from '$lib/games/games-filter-url';
import { PUBLIC_GAMES_SORT_OPTIONS, type PublicGamesSort } from '$lib/games/public-games-query';
import type { GameTranslationRow } from '$lib/server/api/games-with-translations';
import { translationsByGameIds } from '$lib/server/api/games-with-translations';
import { db } from '$lib/server/db';
import { enginesPerGameSubquery } from '$lib/server/db/engines-per-game-subquery';
import { game, gameTranslation } from '$lib/server/db/schema';
import { getTranslationProgressLabel } from '$lib/utils/game-translation-labels';
import { and, asc, count, desc, eq, exists, ilike, not, or, sql, type SQL } from 'drizzle-orm';

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
	translationStatus: string | null;
	translationStatusLabel: string | null;
	translationVersion: string | null;
};

function pickPrimaryTranslation(translations: GameTranslationRow[]): GameTranslationRow | null {
	if (translations.length === 0) return null;
	const vf = translations.find((t) => t.ttype === 'vf');
	if (vf) return vf;
	const completed = translations.find((t) => t.status === 'completed');
	if (completed) return completed;
	return translations[0];
}

function translationExistsWhere(extra?: SQL): SQL {
	const conditions = extra
		? and(eq(gameTranslation.gameId, game.id), extra)
		: eq(gameTranslation.gameId, game.id);
	return exists(db.select({ one: gameTranslation.id }).from(gameTranslation).where(conditions));
}

function versionIntegratedCondition(): SQL {
	return or(
		sql`lower(trim(${gameTranslation.tversion})) in ('intégrée', 'integree')`,
		eq(gameTranslation.tname, 'integrated')
	)!;
}

function versionUpToDateCondition(): SQL {
	return or(
		and(
			sql`nullif(trim(coalesce(${gameTranslation.version}, '')), '') is not null`,
			sql`trim(coalesce(${gameTranslation.version}, '')) = trim(coalesce(${gameTranslation.tversion}, ''))`
		),
		versionIntegratedCondition()
	)!;
}

function versionOutdatedCondition(): SQL {
	return and(
		sql`trim(coalesce(${gameTranslation.version}, '')) <> trim(coalesce(${gameTranslation.tversion}, ''))`,
		not(versionIntegratedCondition())
	)!;
}

function buildVersionMatch(value: string): SQL | undefined {
	switch (value) {
		case 'up_to_date':
			return translationExistsWhere(versionUpToDateCondition());
		case 'integrated':
			return translationExistsWhere(versionIntegratedCondition());
		case 'outdated':
			return translationExistsWhere(versionOutdatedCondition());
		default:
			return undefined;
	}
}

function buildSiteMatch(value: string): SQL | undefined {
	if (!['f95z', 'lc', 'other'].includes(value)) return undefined;
	return eq(game.website, value);
}

function buildTypeMatch(value: string): SQL | undefined {
	return translationExistsWhere(eq(gameTranslation.gameType, value));
}

function buildStatusMatch(value: string): SQL | undefined {
	if (!['in_progress', 'abandoned', 'completed'].includes(value)) return undefined;
	return translationExistsWhere(eq(gameTranslation.status, value));
}

function buildTtypeMatch(value: string): SQL | undefined {
	return translationExistsWhere(eq(gameTranslation.ttype, value));
}

function buildTraductorMatch(value: string): SQL | undefined {
	return translationExistsWhere(
		or(eq(gameTranslation.translatorId, value), eq(gameTranslation.proofreaderId, value))
	);
}

function buildTagInclude(tag: string): SQL {
	return ilike(game.tags, `%${tag}%`);
}

function buildTagExclude(tag: string): SQL {
	return not(ilike(game.tags, `%${tag}%`));
}

function applyGroupFilter(
	parts: SQL[],
	group: FilterSelection,
	matchValue: (value: string) => SQL | undefined,
	options?: { tagsAndIncludes?: boolean }
): void {
	const includes = group.includes
		.map((v) => matchValue(v))
		.filter((c): c is SQL => c !== undefined);
	const excludes = group.excludes
		.map((v) => matchValue(v))
		.filter((c): c is SQL => c !== undefined);

	if (includes.length > 0) {
		if (options?.tagsAndIncludes) {
			for (const clause of group.includes.map((t) => buildTagInclude(t))) {
				parts.push(clause);
			}
		} else {
			parts.push(or(...includes)!);
		}
	}

	for (const value of group.excludes) {
		if (options?.tagsAndIncludes) {
			parts.push(buildTagExclude(value));
		} else {
			const clause = matchValue(value);
			if (clause) parts.push(not(clause));
		}
	}
}

function buildWhereClause(params: PublicGamesListParams) {
	const parts: SQL[] = [];

	if (params.query) {
		const threadIdQuery = Number.parseInt(params.query, 10);
		parts.push(
			Number.isNaN(threadIdQuery)
				? ilike(game.name, `%${params.query}%`)
				: or(ilike(game.name, `%${params.query}%`), eq(game.threadId, threadIdQuery))!
		);
	}

	applyGroupFilter(parts, params.filters.site, buildSiteMatch);
	applyGroupFilter(parts, params.filters.version, buildVersionMatch);
	applyGroupFilter(parts, params.filters.type, buildTypeMatch);
	applyGroupFilter(parts, params.filters.status, buildStatusMatch);
	applyGroupFilter(parts, params.filters.ttype, buildTtypeMatch);
	applyGroupFilter(parts, params.filters.traductor, buildTraductorMatch);
	applyGroupFilter(parts, params.filters.tags, buildTagInclude, { tagsAndIncludes: true });

	if (parts.length === 0) return undefined;
	if (parts.length === 1) return parts[0];
	return and(...parts);
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

	const rows = await db
		.select({
			id: game.id,
			name: game.name,
			image: game.image,
			link: game.link,
			website: game.website,
			gameVersion: game.gameVersion,
			updatedAt: game.updatedAt,
			engineTypes: enginesPerGameSubquery.engineTypes
		})
		.from(game)
		.leftJoin(enginesPerGameSubquery, eq(game.id, enginesPerGameSubquery.gameId))
		.where(where)
		.orderBy(buildOrderBy(params.sort))
		.limit(PUBLIC_GAMES_PAGE_SIZE)
		.offset(offset);

	const byGame = await translationsByGameIds(rows.map((r) => r.id));

	const games: PublicGameListItem[] = rows.map((row) => {
		const translations = byGame.get(row.id) ?? [];
		const primary = pickPrimaryTranslation(translations);
		return {
			id: row.id,
			name: row.name,
			image: row.image,
			link: row.link,
			website: row.website,
			gameVersion: row.gameVersion,
			engineTypes: Array.isArray(row.engineTypes) ? row.engineTypes.map(String) : [],
			updatedAt: row.updatedAt,
			translationCount: translations.length,
			translationStatus: primary?.status ?? null,
			translationStatusLabel: primary ? getTranslationProgressLabel(primary.status) : null,
			translationVersion: primary?.tversion ?? null
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
