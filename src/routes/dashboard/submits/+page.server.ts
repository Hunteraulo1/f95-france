import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { sendDiscordWebhookUpdatesSubmissionApplied } from '$lib/server/discord-webhook';
import { assertPermission } from '$lib/server/permissions';
import { submissionReviewedByUserIdPatch } from '$lib/server/schema-column-compat';
import { submissionOpenedByUserIdPatch } from '$lib/server/submission-opened-by-compat';
import {
	formDataToSubmissionPayload,
	loadSubmissionListPage,
	parseSubmissionStatusFilter
} from '$lib/server/submission-pages';
import {
	normalizeTranslationInPayload,
	parseSubmissionPayloadJson,
	persistSubmissionPayload,
	validateSubmissionPayloadForType
} from '$lib/server/submission-payload-update';
import { applySubmission, revertSubmission } from '$lib/server/submissions';
import { isReviewedSubmissionStatus } from '$lib/utils/submissions';
import { fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	await assertPermission(locals, 'submissions.review');

	const statusFilter = parseSubmissionStatusFilter(url.searchParams.get('status'));

	try {
		const whereCondition =
			statusFilter === 'all' ? undefined : eq(table.submission.status, statusFilter);

		return await loadSubmissionListPage({
			where: whereCondition,
			statusFilter,
			requestedPage: 1,
			includeAdminNotes: true
		});
	} catch (error: unknown) {
		console.warn(
			'Erreur chargement soumissions (admin) — vérifier migrations (`opened_by_user_id`) :',
			error
		);
		return {
			submissions: [],
			statusFilter,
			page: 1,
			pageSize: 20,
			totalCount: 0,
			totalPages: 1,
			pendingCount: 0,
			openedCount: 0,
			toFixCount: 0,
			acceptedCount: 0,
			rejectedCount: 0,
			translators: []
		};
	}
};

export const actions: Actions = {
	openSubmission: async ({ request, locals }) => {
		await assertPermission(locals, 'submissions.review');

		const formData = await request.formData();
		const submissionId = formData.get('submissionId') as string;
		if (!submissionId) return fail(400, { message: 'submissionId requis' });

		await db
			.update(table.submission)
			.set({
				status: 'opened',
				updatedAt: new Date(),
				...(await submissionOpenedByUserIdPatch(locals.user!.id))
			})
			.where(and(eq(table.submission.id, submissionId), eq(table.submission.status, 'pending')));

		return { success: true };
	},
	updateSubmissionData: async ({ request, locals }) => {
		await assertPermission(locals, 'submissions.review');

		const formData = await request.formData();
		const submissionId = formData.get('submissionId');
		const submissionDataJson = formData.get('submissionDataJson');

		if (typeof submissionId !== 'string' || !submissionId.trim()) {
			return fail(400, { message: 'ID de soumission requis' });
		}

		const [sub] = await db
			.select({
				id: table.submission.id,
				status: table.submission.status,
				type: table.submission.type
			})
			.from(table.submission)
			.where(eq(table.submission.id, submissionId))
			.limit(1);

		if (!sub) return fail(404, { message: 'Soumission non trouvée' });
		if (sub.type === 'delete') {
			return fail(400, {
				message: 'Les soumissions de suppression ne peuvent pas être modifiées.'
			});
		}
		if (
			sub.status !== 'pending' &&
			sub.status !== 'opened' &&
			sub.status !== 'rejected' &&
			sub.status !== 'to_fix'
		) {
			return fail(400, {
				message: 'Seules les soumissions en attente, ouvertes ou refusées peuvent être modifiées'
			});
		}

		let parsed = parseSubmissionPayloadJson(submissionDataJson);
		if (!parsed.ok) {
			const rebuiltPayload = formDataToSubmissionPayload(sub.type, formData);
			if (!rebuiltPayload) return fail(400, { message: parsed.message });
			parsed = { ok: true, data: rebuiltPayload };
		}

		normalizeTranslationInPayload(parsed.data);
		const shapeError = validateSubmissionPayloadForType(sub.type, parsed.data);
		if (shapeError) return fail(400, { message: shapeError });

		await persistSubmissionPayload(submissionId, parsed.data);

		return { success: true };
	},
	updateStatus: async ({ request, locals }) => {
		await assertPermission(locals, 'submissions.review');

		const formData = await request.formData();
		const submissionId = formData.get('submissionId') as string;
		const status = formData.get('status') as string;
		const adminNotes = formData.get('adminNotes') as string;
		const submissionDataJson = formData.get('submissionDataJson');
		const expectedUpdatedAt = formData.get('expectedUpdatedAt') as string | null;

		if (!submissionId || !status) {
			return fail(400, { message: 'ID de soumission et statut requis' });
		}

		if (!['pending', 'opened', 'to_fix', 'accepted', 'rejected'].includes(status)) {
			return fail(400, { message: 'Statut invalide' });
		}

		if (
			(status === 'rejected' || status === 'to_fix') &&
			(!adminNotes || adminNotes.trim() === '')
		) {
			return fail(400, {
				message:
					status === 'to_fix'
						? 'Une note admin est obligatoire pour demander une correction'
						: 'Une note admin est obligatoire pour refuser une soumission'
			});
		}

		try {
			const currentSubmission = await db
				.select({
					status: table.submission.status,
					userId: table.submission.userId,
					type: table.submission.type,
					data: table.submission.data,
					translationId: table.submission.translationId,
					updatedAt: table.submission.updatedAt
				})
				.from(table.submission)
				.where(eq(table.submission.id, submissionId))
				.limit(1);

			if (currentSubmission.length === 0) {
				return fail(404, { message: 'Soumission non trouvée' });
			}

			if (expectedUpdatedAt && currentSubmission[0].updatedAt.toISOString() !== expectedUpdatedAt) {
				return fail(409, {
					message:
						'Cette soumission a été modifiée entre-temps par quelqu’un d’autre. Veuillez recharger la page avant de continuer.'
				});
			}

			const currentStatus = currentSubmission[0].status;
			const submissionUserId = currentSubmission[0].userId;
			const submissionType = currentSubmission[0].type;

			if (submissionDataJson !== null && submissionType !== 'delete') {
				let parsed = parseSubmissionPayloadJson(submissionDataJson);
				if (!parsed.ok) {
					const rebuiltPayload = formDataToSubmissionPayload(submissionType, formData);
					if (!rebuiltPayload) return fail(400, { message: parsed.message });
					parsed = { ok: true, data: rebuiltPayload };
				}
				normalizeTranslationInPayload(parsed.data);
				const shapeError = validateSubmissionPayloadForType(submissionType, parsed.data);
				if (shapeError) {
					return fail(400, { message: shapeError });
				}
				await persistSubmissionPayload(submissionId, parsed.data);
			}

			if (status === 'pending' && currentStatus === 'accepted') {
				return fail(400, {
					message: 'Impossible de repasser en attente depuis une soumission acceptée'
				});
			}

			const statusUpdate: {
				status: 'pending' | 'opened' | 'to_fix' | 'accepted' | 'rejected';
				adminNotes: string | null;
				openedByUserId?: string | null;
				reviewedByUserId?: string | null;
			} = {
				status: status as 'pending' | 'opened' | 'to_fix' | 'accepted' | 'rejected',
				adminNotes: adminNotes || null
			};
			if (status === 'opened' && currentStatus === 'pending') {
				Object.assign(statusUpdate, await submissionOpenedByUserIdPatch(locals.user!.id));
			}
			if (status === 'pending') {
				Object.assign(statusUpdate, await submissionOpenedByUserIdPatch(null));
				Object.assign(statusUpdate, await submissionReviewedByUserIdPatch(null));
			}
			if (isReviewedSubmissionStatus(status)) {
				Object.assign(statusUpdate, await submissionReviewedByUserIdPatch(locals.user!.id));
			}
			await db
				.update(table.submission)
				.set(statusUpdate)
				.where(eq(table.submission.id, submissionId));

			if (currentStatus !== status) {
				try {
					const { notifySubmissionStatusChange } = await import('$lib/server/notifications');
					await notifySubmissionStatusChange(
						submissionUserId,
						submissionId,
						currentStatus,
						status,
						submissionType,
						adminNotes
					);
				} catch (notificationError: unknown) {
					console.error('Erreur lors de la création de la notification:', notificationError);
				}
			}

			if (status === 'accepted' && currentStatus !== 'accepted') {
				try {
					const translationWasUpdate =
						submissionType === 'translation' && !!currentSubmission[0].translationId;

					await applySubmission(submissionId);

					const [afterApply] = await db
						.select({
							data: table.submission.data,
							adminNotes: table.submission.adminNotes
						})
						.from(table.submission)
						.where(eq(table.submission.id, submissionId))
						.limit(1);

					void sendDiscordWebhookUpdatesSubmissionApplied({
						submissionId,
						submissionType,
						dataJson: afterApply.data,
						translationWasUpdate,
						adminNotes: afterApply.adminNotes
					});
				} catch (applyError: unknown) {
					console.error("Erreur lors de l'application de la soumission:", applyError);
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

			if (status === 'rejected' && currentStatus === 'accepted') {
				try {
					await revertSubmission(submissionId);
				} catch (revertError: unknown) {
					console.error("Erreur lors de l'annulation de la soumission:", revertError);
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
