import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { fail } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Vérifier que l'utilisateur est admin
	if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
		throw new Error('Accès non autorisé');
	}

	// Récupérer le filtre de statut depuis l'URL
	const statusFilter = url.searchParams.get('status') || 'pending';

	try {
		// Construire la condition de filtre
		let whereCondition;
		if (statusFilter === 'all') {
			whereCondition = undefined; // Pas de filtre, toutes les soumissions
		} else {
			whereCondition = eq(table.submission.status, statusFilter as 'pending' | 'accepted' | 'rejected');
		}

		// Charger les soumissions avec les informations utilisateur
		const submissions = await db
			.select({
				id: table.submission.id,
				status: table.submission.status,
				type: table.submission.type,
				title: table.submission.title,
				description: table.submission.description,
				adminNotes: table.submission.adminNotes,
				createdAt: table.submission.createdAt,
				updatedAt: table.submission.updatedAt,
				user: {
					id: table.user.id,
					username: table.user.username,
					avatar: table.user.avatar
				},
				game: {
					id: table.game.id,
					name: table.game.name,
					image: table.game.image
				}
			})
			.from(table.submission)
			.leftJoin(table.user, eq(table.submission.userId, table.user.id))
			.leftJoin(table.game, eq(table.submission.gameId, table.game.id))
			.where(whereCondition)
			.orderBy(table.submission.createdAt);

		// Compter les soumissions par statut
		const pendingCountResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(eq(table.submission.status, 'pending'));

		const acceptedCountResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(eq(table.submission.status, 'accepted'));

		const pendingCount = pendingCountResult[0]?.count || 0;
		const acceptedCount = acceptedCountResult[0]?.count || 0;

		return {
			submissions: submissions.map(sub => ({
				...sub,
				description: sub.description || '',
				adminNotes: sub.adminNotes || ''
			})),
			statusFilter,
			pendingCount,
			acceptedCount
		};
	} catch (error: unknown) {
		// Si la table n'existe pas encore, retourner des valeurs par défaut
		console.warn('Table submission n\'existe pas encore:', error);
		return {
			submissions: [],
			statusFilter,
			pendingCount: 0,
			acceptedCount: 0
		};
	}
};

export const actions: Actions = {
	updateStatus: async ({ request, locals }) => {
		// Vérifier que l'utilisateur est admin
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return fail(403, { message: 'Accès non autorisé' });
		}

		const formData = await request.formData();
		const submissionId = formData.get('submissionId') as string;
		const status = formData.get('status') as string;
		const adminNotes = formData.get('adminNotes') as string;

		if (!submissionId || !status) {
			return fail(400, { message: 'ID de soumission et statut requis' });
		}

		// Vérifier que le statut est valide
		if (!['pending', 'accepted', 'rejected'].includes(status)) {
			return fail(400, { message: 'Statut invalide' });
		}

		try {
			await db
				.update(table.submission)
				.set({
					status: status as 'pending' | 'accepted' | 'rejected',
					adminNotes: adminNotes || null
				})
				.where(eq(table.submission.id, submissionId));

			return { success: true, message: 'Statut de la soumission mis à jour' };
		} catch (error: unknown) {
			console.error('Erreur lors de la mise à jour du statut:', error);
			return fail(500, { message: 'Erreur lors de la mise à jour du statut' });
		}
	}
};
