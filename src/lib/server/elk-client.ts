import type { AppLogLevel } from '$lib/logs/app-log';
import { isRoutineApiError } from '$lib/server/api-log-noise';
import { privateEnv } from '$lib/server/private-env';

const INDEX_PATTERN = 'f95france-dashboard-*';

type ElkConfig = {
	host: string;
	username: string;
	password: string;
	environment: string;
};

type ElkQueryClause = Record<string, unknown>;

type ElkSearchResponse = {
	hits: {
		total: { value: number };
		hits: Array<{
			_id: string;
			_source: ElkDocument;
		}>;
	};
};

type ElkDocument = {
	'@timestamp': string;
	source?: string;
	message?: string;
	log?: { level?: string };
	meta?: Record<string, unknown> | string | null;
	environment?: string;
};

export type ElkApiLogRow = {
	id: string;
	method: string;
	route: string;
	status: number;
	ipAddress: string | null;
	payload: string | null;
	errorMessage: string | null;
	createdAt: Date;
	user: {
		id: string;
		username: string;
		role: string;
	} | null;
};

export type ElkAppLogRow = {
	id: string;
	level: string;
	source: string;
	message: string;
	meta: string | null;
	createdAt: Date;
};

function getElkConfig(): ElkConfig | null {
	const host = privateEnv('ELASTICSEARCH_HOST');
	const username = privateEnv('ELASTICSEARCH_USERNAME');
	const password = privateEnv('ELASTICSEARCH_PASSWORD');
	if (!host || !username || !password) return null;

	return {
		host: host.replace(/\/$/, ''),
		username,
		password,
		environment: privateEnv('APP_ENV') ?? privateEnv('NODE_ENV') ?? 'unknown'
	};
}

export function isElkReadEnabled(): boolean {
	return getElkConfig() !== null;
}

function normalizeMeta(meta: ElkDocument['meta']): Record<string, unknown> | null {
	if (meta == null) return null;
	if (typeof meta === 'string') {
		try {
			const parsed = JSON.parse(meta) as unknown;
			return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
				? (parsed as Record<string, unknown>)
				: { value: meta };
		} catch {
			return { value: meta };
		}
	}
	return meta;
}

function metaString(value: unknown): string | null {
	if (value == null) return null;
	if (typeof value === 'string') return value;
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

async function elkSearch(body: Record<string, unknown>): Promise<ElkSearchResponse> {
	const config = getElkConfig();
	if (!config) {
		throw new Error('Elasticsearch non configuré');
	}

	const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
	const response = await fetch(`${config.host}/${INDEX_PATTERN}/_search`, {
		method: 'POST',
		headers: {
			Authorization: `Basic ${auth}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(15_000)
	});

	if (!response.ok) {
		const text = await response.text().catch(() => '');
		throw new Error(`Elasticsearch ${response.status}: ${text.slice(0, 500)}`);
	}

	return (await response.json()) as ElkSearchResponse;
}

function environmentClause(): ElkQueryClause {
	const environment = getElkConfig()?.environment ?? 'unknown';
	return { term: { 'environment.keyword': environment } };
}

function dateRangeClause(fromDate: string, toDate: string): ElkQueryClause[] {
	const clauses: ElkQueryClause[] = [];
	if (fromDate) {
		const from = new Date(`${fromDate}T00:00:00.000Z`);
		if (!Number.isNaN(from.getTime())) {
			clauses.push({ range: { '@timestamp': { gte: from.toISOString() } } });
		}
	}
	if (toDate) {
		const toExclusive = new Date(`${toDate}T00:00:00.000Z`);
		if (!Number.isNaN(toExclusive.getTime())) {
			toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
			clauses.push({ range: { '@timestamp': { lt: toExclusive.toISOString() } } });
		}
	}
	return clauses;
}

function mapApiLogHit(hit: ElkSearchResponse['hits']['hits'][number]): ElkApiLogRow {
	const meta = normalizeMeta(hit._source.meta);
	const userId = meta?.userId != null ? String(meta.userId) : null;
	const username = meta?.username != null ? String(meta.username) : null;

	return {
		id: hit._id,
		method: String(meta?.method ?? ''),
		route: String(meta?.route ?? ''),
		status: Number(meta?.status ?? 0),
		ipAddress: metaString(meta?.ipAddress),
		payload: metaString(meta?.payload),
		errorMessage: metaString(meta?.errorMessage),
		createdAt: new Date(hit._source['@timestamp']),
		user:
			userId && username
				? {
						id: userId,
						username,
						role: String(meta?.userRole ?? 'member')
					}
				: null
	};
}

function mapAppLogHit(hit: ElkSearchResponse['hits']['hits'][number]): ElkAppLogRow {
	const meta = hit._source.meta;
	const level = hit._source.log?.level ?? 'info';

	return {
		id: hit._id,
		level,
		source: String(hit._source.source ?? ''),
		message: String(hit._source.message ?? ''),
		meta: metaString(meta),
		createdAt: new Date(hit._source['@timestamp'])
	};
}

export type SearchApiLogsParams = {
	limit: number;
	offset: number;
	methodFilter: string;
	search: string;
	userSearch: string;
	errorsOnly: boolean;
	warningsOnly: boolean;
	redirectsOnly: boolean;
	fromDate: string;
	toDate: string;
};

export async function searchApiLogs(
	params: SearchApiLogsParams
): Promise<{ logs: ElkApiLogRow[]; totalCount: number }> {
	const must: ElkQueryClause[] = [{ term: { 'source.keyword': 'api' } }, environmentClause()];
	const mustNot: ElkQueryClause[] = [{ prefix: { 'meta.route.keyword': '/api/extension-api' } }];

	if (params.methodFilter) {
		must.push({ term: { 'meta.method.keyword': params.methodFilter } });
	}
	if (params.search) {
		must.push({
			bool: {
				should: [
					{
						wildcard: {
							'meta.route.keyword': { value: `*${params.search}*`, case_insensitive: true }
						}
					},
					{
						wildcard: {
							'meta.payload.keyword': { value: `*${params.search}*`, case_insensitive: true }
						}
					},
					{
						wildcard: {
							'meta.ipAddress.keyword': { value: `*${params.search}*`, case_insensitive: true }
						}
					}
				],
				minimum_should_match: 1
			}
		});
	}
	if (params.userSearch) {
		must.push({
			wildcard: {
				'meta.username.keyword': { value: `*${params.userSearch}*`, case_insensitive: true }
			}
		});
	}
	if (params.errorsOnly) {
		must.push({ range: { 'meta.status': { gte: 500 } } });
		mustNot.push(
			{
				bool: {
					must: [
						{ term: { 'meta.status': 502 } },
						{ term: { 'meta.route.keyword': '/dashboard/manager/scrape' } }
					]
				}
			},
			{
				bool: {
					must: [
						{ term: { 'meta.status': 500 } },
						{ term: { 'meta.method.keyword': 'DELETE' } },
						{ prefix: { 'meta.route.keyword': '/dashboard/manager/game/' } }
					]
				}
			}
		);
	}
	if (params.warningsOnly) {
		must.push({ range: { 'meta.status': { gte: 400, lt: 500 } } });
	}
	if (params.redirectsOnly) {
		must.push({ range: { 'meta.status': { gte: 300, lt: 400 } } });
	}

	must.push(...dateRangeClause(params.fromDate, params.toDate));

	const result = await elkSearch({
		track_total_hits: true,
		from: params.offset,
		size: params.limit,
		sort: [{ '@timestamp': { order: 'desc' } }],
		query: {
			bool: { must, must_not: mustNot }
		}
	});

	const logs = result.hits.hits.map(mapApiLogHit).filter((log) => {
		if (!params.errorsOnly) return true;
		return !isRoutineApiError(log.method, log.route, log.status);
	});

	return {
		logs,
		totalCount: result.hits.total.value
	};
}

export type SearchAppLogsParams = {
	limit: number;
	offset: number;
	search: string;
	sourceFilter: string;
	activeLevels: AppLogLevel[];
	fromDate: string;
	toDate: string;
};

export async function searchAppLogs(
	params: SearchAppLogsParams
): Promise<{ logs: ElkAppLogRow[]; totalCount: number }> {
	const must: ElkQueryClause[] = [environmentClause()];
	const mustNot: ElkQueryClause[] = [{ term: { 'source.keyword': 'api' } }];

	if (params.activeLevels.length > 0) {
		must.push({
			terms: { 'log.level.keyword': params.activeLevels }
		});
	}
	if (params.sourceFilter) {
		must.push({ term: { 'source.keyword': params.sourceFilter } });
	}
	if (params.search) {
		must.push({
			bool: {
				should: [
					{ wildcard: { message: { value: `*${params.search}*`, case_insensitive: true } } },
					{
						wildcard: { 'source.keyword': { value: `*${params.search}*`, case_insensitive: true } }
					},
					{ wildcard: { 'meta.keyword': { value: `*${params.search}*`, case_insensitive: true } } }
				],
				minimum_should_match: 1
			}
		});
	}

	must.push(...dateRangeClause(params.fromDate, params.toDate));

	const result = await elkSearch({
		track_total_hits: true,
		from: params.offset,
		size: params.limit,
		sort: [{ '@timestamp': { order: 'desc' } }],
		query: {
			bool: { must, must_not: mustNot }
		}
	});

	return {
		logs: result.hits.hits.map(mapAppLogHit),
		totalCount: result.hits.total.value
	};
}
