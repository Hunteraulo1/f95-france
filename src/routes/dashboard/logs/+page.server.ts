import { db } from '$lib/server/db';
import { apiLog, user } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { and, desc, eq, like, or } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user || locals.user.role !== 'superadmin') {
		throw error(403, 'Accès refusé');
	}

	const limitParam = Number(url.searchParams.get('limit') ?? '100');
	const limit = Number.isNaN(limitParam) ? 100 : Math.min(Math.max(limitParam, 25), 500);
	const methodFilter = url.searchParams.get('method')?.toUpperCase() ?? '';
	const search = url.searchParams.get('q')?.trim() ?? '';

	const conditions = [];
	if (methodFilter) {
		conditions.push(eq(apiLog.method, methodFilter));
	}
	if (search) {
		const pattern = `%${search}%`;
		conditions.push(or(like(apiLog.route, pattern), like(apiLog.payload, pattern)));
	}

	let query = db
		.select({
			id: apiLog.id,
			method: apiLog.method,
			route: apiLog.route,
			status: apiLog.status,
			payload: apiLog.payload,
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
			limit
		}
	};
};
