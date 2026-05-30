import type { FilterSelection } from '$lib/games/games-filter-url';
import { splitGameTags } from '$lib/games/public-game-display';
import { translationsByGameIds } from '$lib/server/api/games-with-translations';
import { embeddedGameFromRow } from '$lib/server/api/updates-embedded-game';
import { db } from '$lib/server/db';
import { game, update as updateTable } from '$lib/server/db/schema';
import {
	buildGameCatalogFilterParts,
	combineSqlParts,
	type GameCatalogFilters
} from '$lib/server/game-catalog-filter-sql';
import {
	effectiveTranslationVersion,
	isTranslationOutdated
} from '$lib/server/api/translation-public';
import { tradVerIndicatesIntegrated } from '$lib/server/translation-notify-rules';
import { pickTranslationForUpdate } from '$lib/updates/pick-update-translation';
import type { PublicUpdatesListParams } from '$lib/updates/updates-filter-url';
import { asc, count, desc, eq, not, or, sql, type SQL } from 'drizzle-orm';

export const PUBLIC_UPDATES_PAGE_SIZE = 24;

export {
	buildPublicUpdatesListSearchParams,
	hasActivePublicUpdatesListFilters,
	parsePublicUpdatesListParams
} from '$lib/updates/updates-filter-url';

export type { PublicUpdatesListParams };

export type PublicUpdateGame = {
	id: string;
	name: string;
	image: string;
	link: string;
	website: string;
	engineType: string | null;
	tags: string[];
	tversion: string | null;
	referenceVersion: string | null;
	hasTranslation: boolean;
	isOutdated: boolean;
	isIntegrated: boolean;
};

export type PublicUpdateRow = {
	id: string;
	status: string;
	createdAt: Date;
	game: PublicUpdateGame;
};

const UPDATE_TYPE_VALUES = ['adding', 'update'] as const;

function buildUpdateTypeMatch(value: string): SQL | undefined {
	if (!UPDATE_TYPE_VALUES.includes(value as (typeof UPDATE_TYPE_VALUES)[number])) return undefined;
	return eq(updateTable.status, value);
}

function applyUpdateTypeFilter(parts: SQL[], group: FilterSelection): void {
	const includes = group.includes
		.map((v) => buildUpdateTypeMatch(v))
		.filter((c): c is SQL => c !== undefined);
	const excludes = group.excludes
		.map((v) => buildUpdateTypeMatch(v))
		.filter((c): c is SQL => c !== undefined);

	if (includes.length > 0) parts.push(or(...includes)!);
	for (const clause of excludes) parts.push(not(clause));
}

function buildWhereClause(params: PublicUpdatesListParams) {
	const parts = buildGameCatalogFilterParts(
		{
			site: params.filters.site,
			version: params.filters.version,
			type: params.filters.type,
			status: params.filters.status,
			ttype: params.filters.ttype,
			traductor: params.filters.traductor,
			tags: params.filters.tags
		} satisfies GameCatalogFilters,
		params.query
	);

	applyUpdateTypeFilter(parts, params.filters.update_type);

	return combineSqlParts(parts);
}

const updateTypeOrder = sql`case ${updateTable.status} when 'adding' then 0 else 1 end`;

const updatesOrderBy = [
	desc(sql`date(${updateTable.createdAt})`),
	asc(updateTypeOrder),
	desc(updateTable.createdAt)
] as const;

export async function listPublicUpdates(params: PublicUpdatesListParams) {
	const page = Math.max(1, params.page);
	const where = buildWhereClause(params);

	const countBase = db
		.select({ total: count() })
		.from(updateTable)
		.innerJoin(game, eq(updateTable.gameId, game.id));
	const [{ total: totalRaw }] = await (where ? countBase.where(where) : countBase);

	const total = Number(totalRaw ?? 0);
	const totalPages = Math.max(1, Math.ceil(total / PUBLIC_UPDATES_PAGE_SIZE));
	const safePage = Math.min(page, totalPages);
	const offset = (safePage - 1) * PUBLIC_UPDATES_PAGE_SIZE;

	const listBase = db
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
			gameTags: game.tags
		})
		.from(updateTable)
		.innerJoin(game, eq(updateTable.gameId, game.id));

	const rows = await (where ? listBase.where(where) : listBase)
		.orderBy(...updatesOrderBy)
		.limit(PUBLIC_UPDATES_PAGE_SIZE)
		.offset(offset);

	const byGame = await translationsByGameIds(rows.map((row) => row.gameId));

	const updates: PublicUpdateRow[] = rows.map((row) => {
		const embedded = embeddedGameFromRow({
			...row,
			gameEngineTypes: []
		});
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
			: null;
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
			id: row.updateId,
			status: row.updateStatus,
			createdAt: row.updateCreatedAt,
			game: {
				id: embedded.id,
				name: embedded.name,
				image: embedded.image,
				link: embedded.link,
				website: embedded.website,
				engineType: translation?.gameType ?? null,
				tags: splitGameTags(embedded.tags),
				tversion,
				referenceVersion,
				hasTranslation: translation !== null,
				isOutdated,
				isIntegrated
			}
		};
	});

	return {
		updates,
		total,
		page: safePage,
		pageSize: PUBLIC_UPDATES_PAGE_SIZE,
		totalPages,
		query: params.query,
		filters: params.filters
	};
}
