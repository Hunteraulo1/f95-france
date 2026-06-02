import { db } from '$lib/server/db';
import { apiLog, user } from '$lib/server/db/schema';
import { assertPermission } from '$lib/server/permissions';
import { error } from '@sveltejs/kit';
import { and, count, desc, eq, gte, like, lt, notLike, or } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	await assertPermission(locals, 'logs.view', 'Accès refusé');

	try {
		const limitParam = Number(url.searchParams.get('limit') ?? '100');
		const limit = Number.isNaN(limitParam) ? 100 : Math.min(Math.max(limitParam, 25), 500);
		const pageParam = Number(url.searchParams.get('page') ?? '1');
		const page = Number.isNaN(pageParam) ? 1 : Math.max(pageParam, 1);
		const offset = (page - 1) * limit;
		const methodFilter = url.searchParams.get('method')?.toUpperCase() ?? '';
		const search = url.searchParams.get('q')?.trim() ?? '';
		const userSearch = url.searchParams.get('user')?.trim() ?? '';
		const errorsOnly = url.searchParams.get('errors') === 'true';
		const warningsOnly = url.searchParams.get('warnings') === 'true';
		const redirectsOnly = url.searchParams.get('redirects') === 'true';
		const fromDate = url.searchParams.get('from')?.trim() ?? '';
		const toDate = url.searchParams.get('to')?.trim() ?? '';

		const conditions = [];
		// Exclure de l'affichage des logs dashboard, les appels à l'api par l'extension.
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

		// Vérifier si la colonne errorMessage existe en essayant une requête simple
		let hasErrorMessageColumn = false;
		try {
			await db.select({ errorMessage: apiLog.errorMessage }).from(apiLog).limit(1);
			hasErrorMessageColumn = true;
		} catch {
			// La colonne n'existe pas encore, on continuera sans elle
			hasErrorMessageColumn = false;
		}

		// Construire la requête avec ou sans errorMessage selon la disponibilité
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
			pagination: {
				page,
				limit,
				totalCount,
				totalPages
			},
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
	} catch (err) {
		console.error('Erreur lors du chargement des logs:', err);
		throw error(
			500,
			`Erreur lors du chargement des logs: ${err instanceof Error ? err.message : String(err)}`
		);
	}
};
