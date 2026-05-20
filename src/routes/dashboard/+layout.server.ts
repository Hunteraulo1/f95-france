import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { getPermissionsForRole, hasPermission, userHasPermission } from '$lib/server/permissions';
import { and, eq, sql } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	let pendingSubmissionsCount = 0;
	let permissions: string[] = [];
	let canManageConfig = false;

	// Charger le nombre de soumissions en attente
	if (locals.user) {
		permissions = await getPermissionsForRole(locals.user.role);
		locals.permissions = permissions;
		canManageConfig = hasPermission(permissions, 'config.view');

		try {
			if (hasPermission(permissions, 'submissions.review')) {
				// Pour les admins, compter toutes les soumissions en attente
				const result = await db
					.select({ count: sql<number>`count(*)`.as('count') })
					.from(table.submission)
					.where(eq(table.submission.status, 'pending'));

				pendingSubmissionsCount = result[0]?.count || 0;
			} else if (hasPermission(permissions, 'submissions.own')) {
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

			if (await userHasPermission(locals.user, 'roles.manage')) {
				hasLinkedTranslator = true;
			}
		} catch (error) {
			console.warn('Erreur lors du chargement du traducteur lié:', error);
		}
	}

	return {
		user: locals.user,
		permissions,
		pendingSubmissionsCount,
		hasLinkedTranslator,
		maintenanceMode,
		canManageConfig
	};
};
