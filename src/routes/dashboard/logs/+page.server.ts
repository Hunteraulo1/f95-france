import { db } from '$lib/server/db';
import { apiLog, user } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { and, desc, eq, gte, like, lt, or, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user || locals.user.role !== 'superadmin') {
		throw error(403, 'Accès refusé');
	}

	const limitParam = Number(url.searchParams.get('limit') ?? '100');
	const limit = Number.isNaN(limitParam) ? 100 : Math.min(Math.max(limitParam, 25), 500);
	const methodFilter = url.searchParams.get('method')?.toUpperCase() ?? '';
	const search = url.searchParams.get('q')?.trim() ?? '';
	const userSearch = url.searchParams.get('user')?.trim() ?? '';
	const errorsOnly = url.searchParams.get('errors') === 'true';
	const warningsOnly = url.searchParams.get('warnings') === 'true';
	const redirectsOnly = url.searchParams.get('redirects') === 'true';

	const conditions = [];
	if (methodFilter) {
		conditions.push(eq(apiLog.method, methodFilter));
	}
	if (search) {
		const pattern = `%${search}%`;
		conditions.push(or(like(apiLog.route, pattern), like(apiLog.payload, pattern)));
	}
	if (userSearch) {
		const userPattern = `%${userSearch}%`;
		conditions.push(like(user.username, userPattern));
	}
	if (errorsOnly) {
		// Filtrer uniquement les erreurs serveur (5xx)
		conditions.push(gte(apiLog.status, 500));
	}
	if (warningsOnly) {
		// Filtrer uniquement les warnings (4xx)
		conditions.push(and(gte(apiLog.status, 400), lt(apiLog.status, 500)));
	}
	if (redirectsOnly) {
		// Filtrer uniquement les redirections (3xx)
		conditions.push(and(gte(apiLog.status, 300), lt(apiLog.status, 400)));
	}

	let query = db
		.select({
			id: apiLog.id,
			method: apiLog.method,
			route: apiLog.route,
			status: apiLog.status,
			payload: apiLog.payload,
			errorMessage: apiLog.errorMessage,
			createdAt: apiLog.createdAt,
			user: {
				id: user.id,
				username: user.username
			}
		})
		.from(apiLog)
		.leftJoin(user, eq(apiLog.userId, user.id))
		.$dynamic();

	if (conditions.length === 1) {
		query = query.where(conditions[0]);
	} else if (conditions.length > 1) {
		query = query.where(and(...conditions));
	}

	const logs = await query.orderBy(desc(apiLog.createdAt)).limit(limit);

	return {
		logs,
		filters: {
			method: methodFilter,
			search,
			user: userSearch,
			errorsOnly,
			warningsOnly,
			redirectsOnly,
			limit
		}
	};
};
