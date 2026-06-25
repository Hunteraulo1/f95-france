import type { GamesFilterGroupName } from '$lib/games/games-filter-config';
import type { FilterSelection } from '$lib/games/games-filter-url';
import { db } from '$lib/server/db';
import { game, gameTranslation } from '$lib/server/db/schema';
import { caseInsensitiveLike } from '$lib/server/sql-like';
import { and, eq, exists, like, not, or, sql, type SQL } from 'drizzle-orm';

export type GameCatalogFilters = Record<GamesFilterGroupName, FilterSelection>;

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

/** Même règle que `effectiveTranslationVersion` : traduction, sinon version du jeu. */
const translationReferenceVersion = sql`nullif(trim(coalesce(${gameTranslation.version}, '')), '')`;
const gameReferenceVersion = sql`nullif(trim(coalesce(${game.gameVersion}, '')), '')`;
const effectiveReferenceVersion = sql`coalesce(${translationReferenceVersion}, ${gameReferenceVersion})`;

function versionUpToDateCondition(): SQL {
	return or(
		versionIntegratedCondition(),
		sql`trim(coalesce(${gameTranslation.tversion}, '')) = trim(coalesce(${effectiveReferenceVersion}, ''))`
	)!;
}

function versionOutdatedCondition(): SQL {
	return and(
		not(versionIntegratedCondition()),
		sql`trim(coalesce(${gameTranslation.tversion}, '')) <> trim(coalesce(${effectiveReferenceVersion}, ''))`
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
	return like(game.tags, `%${tag}%`);
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
			parts.push(not(buildTagInclude(value)));
		} else {
			const clause = matchValue(value);
			if (clause) parts.push(not(clause));
		}
	}
}

/** Filtres catalogue partagés (jeux, mises à jour…) sur la table `game` jointe. */
export function buildGameCatalogFilterParts(filters: GameCatalogFilters, query?: string): SQL[] {
	const parts: SQL[] = [];

	if (query) {
		const threadIdQuery = Number.parseInt(query, 10);
		parts.push(
			Number.isNaN(threadIdQuery)
				? caseInsensitiveLike(game.name, query)
				: or(caseInsensitiveLike(game.name, query), eq(game.threadId, threadIdQuery))!
		);
	}

	applyGroupFilter(parts, filters.site, buildSiteMatch);
	applyGroupFilter(parts, filters.version, buildVersionMatch);
	applyGroupFilter(parts, filters.type, buildTypeMatch);
	applyGroupFilter(parts, filters.status, buildStatusMatch);
	applyGroupFilter(parts, filters.ttype, buildTtypeMatch);
	applyGroupFilter(parts, filters.traductor, buildTraductorMatch);
	applyGroupFilter(parts, filters.tags, buildTagInclude, { tagsAndIncludes: true });

	return parts;
}

export function combineSqlParts(parts: SQL[]): SQL | undefined {
	if (parts.length === 0) return undefined;
	if (parts.length === 1) return parts[0];
	return and(...parts);
}
