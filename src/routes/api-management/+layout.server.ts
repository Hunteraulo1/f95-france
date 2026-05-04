import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	let pendingSubmissionsCount = 0;

	if (locals.user) {
		try {
			if (locals.user.role === 'admin' || locals.user.role === 'superadmin') {
				const result = await db
					.select({ count: sql<number>`count(*)`.as('count') })
					.from(table.submission)
					.where(eq(table.submission.status, 'pending'));

				pendingSubmissionsCount = result[0]?.count || 0;
			} else if (locals.user.role === 'translator') {
				const result = await db
					.select({ count: sql<number>`count(*)`.as('count') })
					.from(table.submission)
					.where(
						and(eq(table.submission.userId, locals.user.id), eq(table.submission.status, 'pending'))
					);

				pendingSubmissionsCount = result[0]?.count || 0;
			}
		} catch (error) {
			console.warn('Erreur lors du chargement des soumissions en attente:', error);
		}
	}

	return {
		user: locals.user,
		pendingSubmissionsCount
	};
};
