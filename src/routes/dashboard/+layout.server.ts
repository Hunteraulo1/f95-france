import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	let pendingSubmissionsCount = 0;

	// Charger le nombre de soumissions en attente
	if (locals.user) {
		try {
			if (locals.user.role === 'admin' || locals.user.role === 'superadmin') {
				// Pour les admins, compter toutes les soumissions en attente
				const result = await db
					.select({ count: sql<number>`count(*)`.as('count') })
					.from(table.submission)
					.where(eq(table.submission.status, 'pending'));

				pendingSubmissionsCount = result[0]?.count || 0;
			} else if (locals.user.role === 'translator') {
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

	let hasLinkedTranslator = false;

	if (locals.user) {
		try {
			const [linkedTranslator] = await db
				.select({ id: table.translator.id })
				.from(table.translator)
				.where(eq(table.translator.userId, locals.user.id))
				.limit(1);

			hasLinkedTranslator = Boolean(linkedTranslator);

			if (locals.user.role === 'superadmin') {
				hasLinkedTranslator = true;
			}
		} catch (error) {
			console.warn('Erreur lors du chargement du traducteur lié:', error);
		}
	}

	return {
		user: locals.user,
		pendingSubmissionsCount,
		hasLinkedTranslator
	};
};
