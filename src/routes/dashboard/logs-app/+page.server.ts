import { APP_LOG_SOURCES, parseAppLogLevelsParam, type AppLogLevel } from '$lib/logs/app-log';
import { db } from '$lib/server/db';
import { appLog } from '$lib/server/db/schema';
import { isElkReadEnabled, searchAppLogs } from '$lib/server/elk-client';
import { assertPermission } from '$lib/server/permissions';
import { error } from '@sveltejs/kit';
import { and, count, desc, eq, gte, inArray, like, lt, or } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

async function loadAppLogsFromMariaDb(
	limit: number,
	page: number,
	offset: number,
	search: string,
	sourceFilter: string,
	activeLevels: AppLogLevel[],
	fromDate: string,
	toDate: string
) {
	const conditions = [inArray(appLog.level, activeLevels)];

	if (sourceFilter) {
		conditions.push(eq(appLog.source, sourceFilter));
	}
	if (search) {
		const pattern = `%${search}%`;
		const searchOr = or(
			like(appLog.message, pattern),
			like(appLog.source, pattern),
			like(appLog.meta, pattern)
		);
		if (searchOr) conditions.push(searchOr);
	}
	if (fromDate) {
		const from = new Date(`${fromDate}T00:00:00.000Z`);
		if (!Number.isNaN(from.getTime())) {
			conditions.push(gte(appLog.createdAt, from));
		}
	}
	if (toDate) {
		const toExclusive = new Date(`${toDate}T00:00:00.000Z`);
		if (!Number.isNaN(toExclusive.getTime())) {
			toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
			conditions.push(lt(appLog.createdAt, toExclusive));
		}
	}

	const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

	const logs = await db
		.select({
			id: appLog.id,
			level: appLog.level,
			source: appLog.source,
			message: appLog.message,
			meta: appLog.meta,
			createdAt: appLog.createdAt
		})
		.from(appLog)
		.where(whereClause)
		.orderBy(desc(appLog.createdAt))
		.limit(limit)
		.offset(offset);

	const [{ value: totalCount }] = await db
		.select({ value: count() })
		.from(appLog)
		.where(whereClause);
	const totalPages = Math.max(1, Math.ceil(totalCount / limit));

	const levelCounts = logs.reduce(
		(acc, log) => {
			const key = log.level as AppLogLevel;
			if (key in acc) acc[key] += 1;
			return acc;
		},
		{ debug: 0, info: 0, warn: 0, error: 0 } satisfies Record<AppLogLevel, number>
	);

	return {
		logs,
		pagination: { page, limit, totalCount, totalPages },
		levelCounts,
		sourceOptions: [...APP_LOG_SOURCES],
		filters: {
			search,
			source: sourceFilter,
			activeLevels,
			limit,
			from: fromDate,
			to: toDate
		}
	};
}

export const load: PageServerLoad = async ({ locals, url }) => {
	await assertPermission(locals, 'logs.view', 'Accès refusé');

	try {
		const limitParam = Number(url.searchParams.get('limit') ?? '100');
		const limit = Number.isNaN(limitParam) ? 100 : Math.min(Math.max(limitParam, 25), 500);
		const pageParam = Number(url.searchParams.get('page') ?? '1');
		const page = Number.isNaN(pageParam) ? 1 : Math.max(pageParam, 1);
		const offset = (page - 1) * limit;
		const search = url.searchParams.get('q')?.trim() ?? '';
		const sourceFilter = url.searchParams.get('source')?.trim() ?? '';
		const fromDate = url.searchParams.get('from')?.trim() ?? '';
		const toDate = url.searchParams.get('to')?.trim() ?? '';
		const activeLevels = parseAppLogLevelsParam(url.searchParams.get('levels'));

		if (!isElkReadEnabled()) {
			return loadAppLogsFromMariaDb(
				limit,
				page,
				offset,
				search,
				sourceFilter,
				activeLevels,
				fromDate,
				toDate
			);
		}

		const { logs, totalCount } = await searchAppLogs({
			limit,
			offset,
			search,
			sourceFilter,
			activeLevels,
			fromDate,
			toDate
		});

		const totalPages = Math.max(1, Math.ceil(totalCount / limit));
		const levelCounts = logs.reduce(
			(acc, log) => {
				const key = log.level as AppLogLevel;
				if (key in acc) acc[key] += 1;
				return acc;
			},
			{ debug: 0, info: 0, warn: 0, error: 0 } satisfies Record<AppLogLevel, number>
		);

		return {
			logs,
			pagination: { page, limit, totalCount, totalPages },
			levelCounts,
			sourceOptions: [...APP_LOG_SOURCES],
			filters: {
				search,
				source: sourceFilter,
				activeLevels,
				limit,
				from: fromDate,
				to: toDate
			}
		};
	} catch (err) {
		console.error('Erreur lors du chargement des logs applicatifs:', err);
		throw error(
			500,
			`Erreur lors du chargement des logs applicatifs: ${err instanceof Error ? err.message : String(err)}`
		);
	}
};
