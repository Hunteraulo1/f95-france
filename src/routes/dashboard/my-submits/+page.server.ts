import { assertDashboardAuthenticated } from '$lib/server/dashboard-auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	formDataToSubmissionPayload,
	loadSubmissionListPage,
	parseSubmissionStatusFilter
} from '$lib/server/submission-pages';
import {
	parseSubmissionPayloadJson,
	persistSubmissionPayload,
	validateSubmissionPayloadForType
} from '$lib/server/submission-payload-update';
import { fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	assertDashboardAuthenticated(locals);

	const statusFilter = parseSubmissionStatusFilter(url.searchParams.get('status'));

	try {
		const whereCondition =
			statusFilter === 'all'
				? eq(table.submission.userId, locals.user!.id)
				: and(
						eq(table.submission.userId, locals.user!.id),
						eq(table.submission.status, statusFilter)
					);

		return await loadSubmissionListPage({
			where: whereCondition,
			statusFilter,
			requestedPage: 1,
			userId: locals.user!.id
		});
	} catch (error: unknown) {
		console.warn(
			'Erreur chargement soumissions — vérifier migrations (`opened_by_user_id`) :',
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
	cancelSubmission: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Non authentifié' });

		const formData = await request.formData();
		const submissionId = formData.get('submissionId');
		if (typeof submissionId !== 'string' || !submissionId.trim()) {
			return fail(400, { message: 'ID de soumission requis' });
		}

		const [sub] = await db
			.select({
				id: table.submission.id,
				userId: table.submission.userId,
				status: table.submission.status
			})
			.from(table.submission)
			.where(eq(table.submission.id, submissionId))
			.limit(1);

		if (!sub) return fail(404, { message: 'Soumission non trouvée' });
		if (sub.userId !== locals.user.id) return fail(403, { message: 'Accès non autorisé' });
		if (sub.status !== 'pending') {
			return fail(400, { message: 'Seules les soumissions en attente peuvent être annulées' });
		}

		await db
			.update(table.submission)
			.set({
				status: 'rejected',
				adminNotes: 'Annulée par l’utilisateur',
				updatedAt: new Date()
			})
			.where(eq(table.submission.id, submissionId));

		return { success: true };
	},
	updateSubmissionData: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Non authentifié' });

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
				adminNotes: table.submission.adminNotes,
				userId: table.submission.userId,
				type: table.submission.type
			})
			.from(table.submission)
			.where(eq(table.submission.id, submissionId))
			.limit(1);

		if (!sub) return fail(404, { message: 'Soumission non trouvée' });
		if (sub.userId !== locals.user.id) return fail(403, { message: 'Accès non autorisé' });
		if (sub.type === 'delete') {
			return fail(403, {
				message: 'Les soumissions de suppression ne peuvent pas être corrigées puis renvoyées'
			});
		}

		if (
			sub.status !== 'pending' &&
			sub.status !== 'opened' &&
			sub.status !== 'to_fix' &&
			sub.status !== 'rejected'
		) {
			return fail(403, {
				message: 'Seules les soumissions en attente, ouvertes ou refusées sont modifiables'
			});
		}

		let parsed = parseSubmissionPayloadJson(submissionDataJson);
		if (!parsed.ok) {
			const rebuiltPayload = formDataToSubmissionPayload(sub.type, formData);
			if (!rebuiltPayload) {
				return fail(400, { message: parsed.message });
			}
			parsed = { ok: true, data: rebuiltPayload };
		}

		const shapeError = validateSubmissionPayloadForType(sub.type, parsed.data);
		if (shapeError) return fail(400, { message: shapeError });

		await persistSubmissionPayload(submissionId, parsed.data);

		if (sub.status === 'rejected' || sub.status === 'to_fix') {
			await db
				.update(table.submission)
				.set({
					status: 'pending',
					adminNotes: null,
					updatedAt: new Date()
				})
				.where(eq(table.submission.id, submissionId));
		}

		return { success: true };
	}
};
