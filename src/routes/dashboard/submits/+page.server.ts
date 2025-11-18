import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { applySubmission, revertSubmission } from '$lib/server/submissions';
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
			whereCondition = eq(
				table.submission.status,
				statusFilter as 'pending' | 'accepted' | 'rejected'
			);
		}

		// Charger les soumissions avec les informations utilisateur
		const submissions = await db
			.select({
				id: table.submission.id,
				status: table.submission.status,
				type: table.submission.type,
				adminNotes: table.submission.adminNotes,
				data: table.submission.data,
				gameId: table.submission.gameId,
				translationId: table.submission.translationId,
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
				},
				translation: {
					id: table.gameTranslation.id,
					version: table.gameTranslation.version,
					tversion: table.gameTranslation.tversion,
					translationName: table.gameTranslation.translationName
				}
			})
			.from(table.submission)
			.leftJoin(table.user, eq(table.submission.userId, table.user.id))
			.leftJoin(table.game, eq(table.submission.gameId, table.game.id))
			.leftJoin(table.gameTranslation, eq(table.submission.translationId, table.gameTranslation.id))
			.where(whereCondition)
			.orderBy(table.submission.createdAt);

		// Parser les données et récupérer les jeux/traductions actuels pour les modifications
		const submissionsWithData = await Promise.all(
			submissions.map(async (sub) => {
				let parsedData = null;
				let currentGame = null;
				let currentTranslation = null;

				if (sub.data) {
					try {
						parsedData = JSON.parse(sub.data);
					} catch (e) {
						console.error('Erreur lors du parsing des données de soumission:', e);
					}
				}

				// Pour les modifications de jeu, récupérer le jeu actuel
				if (sub.type === 'update' && sub.gameId && !sub.translationId) {
					const currentGameResult = await db
						.select()
						.from(table.game)
						.where(eq(table.game.id, sub.gameId))
						.limit(1);

					if (currentGameResult.length > 0) {
						currentGame = currentGameResult[0];
					}
				}

				// Pour les modifications de traduction, récupérer la traduction actuelle
				if (sub.type === 'translation' && sub.translationId) {
					const currentTranslationResult = await db
						.select()
						.from(table.gameTranslation)
						.where(eq(table.gameTranslation.id, sub.translationId))
						.limit(1);

					if (currentTranslationResult.length > 0) {
						currentTranslation = currentTranslationResult[0];
					}
				}

				return {
					...sub,
					adminNotes: sub.adminNotes || '',
					parsedData,
					currentGame,
					currentTranslation
				};
			})
		);

		// Compter les soumissions par statut
		const pendingCountResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(eq(table.submission.status, 'pending'));

		const acceptedCountResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(eq(table.submission.status, 'accepted'));

		const rejectedCountResult = await db
			.select({ count: sql<number>`count(*)`.as('count') })
			.from(table.submission)
			.where(eq(table.submission.status, 'rejected'));

		const pendingCount = pendingCountResult[0]?.count || 0;
		const acceptedCount = acceptedCountResult[0]?.count || 0;
		const rejectedCount = rejectedCountResult[0]?.count || 0;

		// Charger tous les traducteurs pour pouvoir afficher leurs noms
		const translators = await db
			.select({
				id: table.translator.id,
				name: table.translator.name
			})
			.from(table.translator);

		return {
			submissions: submissionsWithData,
			statusFilter,
			pendingCount,
			acceptedCount,
			rejectedCount,
			translators
		};
	} catch (error: unknown) {
		// Si la table n'existe pas encore, retourner des valeurs par défaut
		console.warn("Table submission n'existe pas encore:", error);
		return {
			submissions: [],
			statusFilter,
			pendingCount: 0,
			acceptedCount: 0,
			rejectedCount: 0,
			translators: []
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

		// Si le statut est "rejected", la note admin est obligatoire
		if (status === 'rejected' && (!adminNotes || adminNotes.trim() === '')) {
			return fail(400, { message: 'Une note admin est obligatoire pour refuser une soumission' });
		}

		try {
			// Récupérer la soumission actuelle pour vérifier son statut
			const currentSubmission = await db
				.select({
					status: table.submission.status,
					userId: table.submission.userId,
					type: table.submission.type
				})
				.from(table.submission)
				.where(eq(table.submission.id, submissionId))
				.limit(1);

			if (currentSubmission.length === 0) {
				return fail(404, { message: 'Soumission non trouvée' });
			}

			const currentStatus = currentSubmission[0].status;
			const submissionUserId = currentSubmission[0].userId;
			const submissionType = currentSubmission[0].type;

			// Mettre à jour le statut
			await db
				.update(table.submission)
				.set({
					status: status as 'pending' | 'accepted' | 'rejected',
					adminNotes: adminNotes || null
				})
				.where(eq(table.submission.id, submissionId));

			// Créer une notification si le statut a changé
			if (currentStatus !== status) {
				try {
					const { notifySubmissionStatusChange } = await import('$lib/server/notifications');
					await notifySubmissionStatusChange(
						submissionUserId,
						submissionId,
						currentStatus,
						status,
						submissionType
					);
				} catch (notificationError: unknown) {
					// Ne pas bloquer la mise à jour du statut si la notification échoue
					console.error('Erreur lors de la création de la notification:', notificationError);
				}
			}

			// Si la soumission est acceptée et qu'elle ne l'était pas déjà, appliquer les changements
			if (status === 'accepted' && currentStatus !== 'accepted') {
				try {
					await applySubmission(submissionId);
				} catch (applyError: unknown) {
					console.error("Erreur lors de l'application de la soumission:", applyError);
					// Revenir au statut précédent en cas d'erreur
					await db
						.update(table.submission)
						.set({
							status: currentStatus,
							adminNotes: adminNotes || null
						})
						.where(eq(table.submission.id, submissionId));

					const errorMessage =
						applyError instanceof Error
							? applyError.message
							: "Erreur lors de l'application de la soumission";
					return fail(500, { message: errorMessage });
				}
			}

			// Si la soumission passe de "accepted" à "rejected", annuler les changements
			if (status === 'rejected' && currentStatus === 'accepted') {
				try {
					await revertSubmission(submissionId);
				} catch (revertError: unknown) {
					console.error("Erreur lors de l'annulation de la soumission:", revertError);
					// Revenir au statut précédent en cas d'erreur
					await db
						.update(table.submission)
						.set({
							status: currentStatus,
							adminNotes: adminNotes || null
						})
						.where(eq(table.submission.id, submissionId));

					const errorMessage =
						revertError instanceof Error
							? revertError.message
							: "Erreur lors de l'annulation de la soumission";
					return fail(500, { message: errorMessage });
				}
			}

			return { success: true, message: 'Statut de la soumission mis à jour' };
		} catch (error: unknown) {
			console.error('Erreur lors de la mise à jour du statut:', error);
			return fail(500, { message: 'Erreur lors de la mise à jour du statut' });
		}
	}
};
