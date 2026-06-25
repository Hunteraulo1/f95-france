import { db } from '$lib/server/db';
import { apiLog, user } from '$lib/server/db/schema';
import { isElkReadEnabled, searchApiLogs } from '$lib/server/elk-client';
import { and, count, desc, eq, gte, like, lt, not, notLike, or, sql } from 'drizzle-orm';

export type DashboardApiLogsPageResult = {
	logs: Array<{
		id: string;
		method: string;
		route: string;
		status: number;
		ipAddress: string | null;
		payload: string | null;
		errorMessage?: string | null;
		createdAt: Date;
		user: { id: string | null; username: string | null; role: string | null } | null;
	}>;
	pagination: { page: number; limit: number; totalCount: number; totalPages: number };
	statusCounts: { s2xx: number; s3xx: number; s4xx: number; s5xx: number };
	filters: {
		method: string;
		search: string;
		user: string;
		errorsOnly: boolean;
		warningsOnly: boolean;
		redirectsOnly: boolean;
		limit: number;
		from: string;
		to: string;
	};
};

async function loadApiLogsFromMariaDb(
	limit: number,
	page: number,
	offset: number,
	methodFilter: string,
	search: string,
	userSearch: string,
	errorsOnly: boolean,
	warningsOnly: boolean,
	redirectsOnly: boolean,
	fromDate: string,
	toDate: string
): Promise<DashboardApiLogsPageResult> {
	const conditions = [];
	conditions.push(notLike(apiLog.route, '/api/extension-api%'));

	if (methodFilter) {
		conditions.push(eq(apiLog.method, methodFilter));
	}
	if (search) {
		const pattern = `%${search}%`;
		conditions.push(
			or(
				like(apiLog.route, pattern),
				like(apiLog.payload, pattern),
				like(apiLog.ipAddress, pattern)
			)
		);
	}
	if (userSearch) {
		const userPattern = `%${userSearch}%`;
		conditions.push(like(user.username, userPattern));
	}
	if (errorsOnly) {
		conditions.push(gte(apiLog.status, 500));
		const operationalNoise = or(
			and(eq(apiLog.status, 502), eq(apiLog.route, '/dashboard/manager/scrape')),
			and(
				eq(apiLog.status, 500),
				eq(apiLog.method, 'DELETE'),
				sql`${apiLog.route} like '/dashboard/manager/game/%'`
			)
		);
		if (operationalNoise) {
			conditions.push(not(operationalNoise));
		}
	}
	if (warningsOnly) {
		conditions.push(and(gte(apiLog.status, 400), lt(apiLog.status, 500)));
	}
	if (redirectsOnly) {
		conditions.push(and(gte(apiLog.status, 300), lt(apiLog.status, 400)));
	}
	if (fromDate) {
		const from = new Date(`${fromDate}T00:00:00.000Z`);
		if (!Number.isNaN(from.getTime())) {
			conditions.push(gte(apiLog.createdAt, from));
		}
	}
	if (toDate) {
		const toExclusive = new Date(`${toDate}T00:00:00.000Z`);
		if (!Number.isNaN(toExclusive.getTime())) {
			toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
			conditions.push(lt(apiLog.createdAt, toExclusive));
		}
	}

	let hasErrorMessageColumn = false;
	try {
		await db.select({ errorMessage: apiLog.errorMessage }).from(apiLog).limit(1);
		hasErrorMessageColumn = true;
	} catch {
		// Colonne error_message absente (migration pas encore appliquée)
	}

	let query;
	if (hasErrorMessageColumn) {
		query = db
			.select({
				id: apiLog.id,
				method: apiLog.method,
				route: apiLog.route,
				status: apiLog.status,
				ipAddress: apiLog.ipAddress,
				payload: apiLog.payload,
				errorMessage: apiLog.errorMessage,
				createdAt: apiLog.createdAt,
				user: {
					id: user.id,
					username: user.username,
					role: user.role
				}
			})
			.from(apiLog)
			.leftJoin(user, eq(apiLog.userId, user.id))
			.$dynamic();
	} else {
		query = db
			.select({
				id: apiLog.id,
				method: apiLog.method,
				route: apiLog.route,
				status: apiLog.status,
				ipAddress: apiLog.ipAddress,
				payload: apiLog.payload,
				createdAt: apiLog.createdAt,
				user: {
					id: user.id,
					username: user.username,
					role: user.role
				}
			})
			.from(apiLog)
			.leftJoin(user, eq(apiLog.userId, user.id))
			.$dynamic();
	}

	if (conditions.length === 1) {
		query = query.where(conditions[0]);
	} else if (conditions.length > 1) {
		query = query.where(and(...conditions));
	}

	const logs = await query.orderBy(desc(apiLog.createdAt)).limit(limit).offset(offset);

	let countQuery = db
		.select({ value: count() })
		.from(apiLog)
		.leftJoin(user, eq(apiLog.userId, user.id))
		.$dynamic();
	if (conditions.length === 1) {
		countQuery = countQuery.where(conditions[0]);
	} else if (conditions.length > 1) {
		countQuery = countQuery.where(and(...conditions));
	}
	const [{ value: totalCount }] = await countQuery;
	const totalPages = Math.max(1, Math.ceil(totalCount / limit));

	const statusCounts = logs.reduce(
		(acc, log) => {
			if (log.status >= 500) acc.s5xx += 1;
			else if (log.status >= 400) acc.s4xx += 1;
			else if (log.status >= 300) acc.s3xx += 1;
			else if (log.status >= 200) acc.s2xx += 1;
			return acc;
		},
		{ s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0 }
	);

	return {
		logs,
		pagination: { page, limit, totalCount, totalPages },
		statusCounts,
		filters: {
			method: methodFilter,
			search,
			user: userSearch,
			errorsOnly,
			warningsOnly,
			redirectsOnly,
			limit,
			from: fromDate,
			to: toDate
		}
	};
}

export async function loadDashboardApiLogsPage(
	url: URL,
	requestedPage: number
): Promise<DashboardApiLogsPageResult> {
	const limitParam = Number(url.searchParams.get('limit') ?? '100');
	const limit = Number.isNaN(limitParam) ? 100 : Math.min(Math.max(limitParam, 25), 500);
	const page = Number.isNaN(requestedPage) ? 1 : Math.max(requestedPage, 1);
	const offset = (page - 1) * limit;
	const methodFilter = url.searchParams.get('method')?.toUpperCase() ?? '';
	const search = url.searchParams.get('q')?.trim() ?? '';
	const userSearch = url.searchParams.get('user')?.trim() ?? '';
	const errorsOnly = url.searchParams.get('errors') === 'true';
	const warningsOnly = url.searchParams.get('warnings') === 'true';
	const redirectsOnly = url.searchParams.get('redirects') === 'true';
	const fromDate = url.searchParams.get('from')?.trim() ?? '';
	const toDate = url.searchParams.get('to')?.trim() ?? '';

	if (!isElkReadEnabled()) {
		return loadApiLogsFromMariaDb(
			limit,
			page,
			offset,
			methodFilter,
			search,
			userSearch,
			errorsOnly,
			warningsOnly,
			redirectsOnly,
			fromDate,
			toDate
		);
	}

	const { logs, totalCount } = await searchApiLogs({
		limit,
		offset,
		methodFilter,
		search,
		userSearch,
		errorsOnly,
		warningsOnly,
		redirectsOnly,
		fromDate,
		toDate
	});

	const totalPages = Math.max(1, Math.ceil(totalCount / limit));
	const statusCounts = logs.reduce(
		(acc, log) => {
			if (log.status >= 500) acc.s5xx += 1;
			else if (log.status >= 400) acc.s4xx += 1;
			else if (log.status >= 300) acc.s3xx += 1;
			else if (log.status >= 200) acc.s2xx += 1;
			return acc;
		},
		{ s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0 }
	);

	return {
		logs,
		pagination: { page, limit, totalCount, totalPages },
		statusCounts,
		filters: {
			method: methodFilter,
			search,
			user: userSearch,
			errorsOnly,
			warningsOnly,
			redirectsOnly,
			limit,
			from: fromDate,
			to: toDate
		}
	};
}
