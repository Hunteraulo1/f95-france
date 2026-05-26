import { isPublicDashboardPath } from '$lib/server/dashboard-auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { getDevImpersonationOriginUser } from '$lib/server/dev-impersonation';
import { getPermissionsForRole, hasPermission } from '$lib/server/permissions';
import { listRoleBadgeStylesMap } from '$lib/server/role-badge-styles';
import { and, eq, sql } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies, url }) => {
	const pathname = url.pathname;

	if (!locals.user && !isPublicDashboardPath(pathname)) {
		const redirectTo = encodeURIComponent(pathname + url.search);
		redirect(303, `/dashboard/login?redirectTo=${redirectTo}`);
	}

	let pendingSubmissionsCount = 0;
	let permissions: string[] = [];
	let canManageConfig = false;

	// Charger le nombre de soumissions en attente
	if (locals.user) {
		permissions = await getPermissionsForRole(locals.user.role);
		locals.permissions = permissions;
		canManageConfig = hasPermission(locals, 'config.view');

		try {
			if (hasPermission(locals, 'submissions.review')) {
				// Pour les admins, compter toutes les soumissions en attente
				const result = await db
					.select({ count: sql<number>`count(*)`.as('count') })
					.from(table.submission)
					.where(eq(table.submission.status, 'pending'));

				pendingSubmissionsCount = result[0]?.count || 0;
			} else if (hasPermission(locals, 'submissions.own')) {
				// Pour les traducteurs, compter leurs propres soumissions en attente
				const result = await db
					.select({ count: sql<number>`count(*)`.as('count') })
					.from(table.submission)
					.where(
						and(eq(table.submission.userId, locals.user.id), eq(table.submission.status, 'pending'))
					);

				pendingSubmissionsCount = result[0]?.count || 0;
			}
		} catch (error) {
			// Si la table n'existe pas encore, ignorer l'erreur
			console.warn('Erreur lors du chargement des soumissions en attente:', error);
		}
	}

	let maintenanceMode = false;

	try {
		const [cfg] = await db
			.select({ maintenanceMode: table.config.maintenanceMode })
			.from(table.config)
			.where(eq(table.config.id, 'main'))
			.limit(1);
		maintenanceMode = cfg?.maintenanceMode === true;
	} catch (error) {
		console.warn('Erreur lors du chargement du mode maintenance:', error);
	}

	let hasLinkedTranslator = false;

	if (locals.user) {
		try {
			const [linkedTranslator] = await db
				.select({ id: table.translator.id })
				.from(table.translator)
				.where(eq(table.translator.userId, locals.user.id))
				.limit(1);

			hasLinkedTranslator = Boolean(linkedTranslator);

			if (hasPermission(locals, 'roles.manage')) {
				hasLinkedTranslator = true;
			}
		} catch (error) {
			console.warn('Erreur lors du chargement du traducteur lié:', error);
		}
	}

	const devOriginUser = locals.user ? await getDevImpersonationOriginUser(cookies) : null;
	const roleBadgeStyles = await listRoleBadgeStylesMap();

	return {
		user: locals.user,
		permissions,
		roleBadgeStyles,
		pendingSubmissionsCount,
		hasLinkedTranslator,
		maintenanceMode,
		canManageConfig,
		canReturnToOwnAccount: Boolean(devOriginUser),
		devOriginUsername: devOriginUser?.username ?? null
	};
};
