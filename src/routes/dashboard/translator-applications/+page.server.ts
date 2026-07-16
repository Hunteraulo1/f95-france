import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { ensureTranslatorByName } from '$lib/server/ensure-translator';
import { notifyTranslatorApplicationStatusChange } from '$lib/server/notifications';
import { invalidatePendingTranslatorApplicationsCountCache } from '$lib/server/pending-translator-applications-count';
import { assertPermission, hasPermissionForUser } from '$lib/server/permissions';
import { assignTranslatorUser } from '$lib/server/translator-user-link';
import { assertCanAssignUserRole } from '$lib/server/user-role-assignment-guard';
import { fail } from '@sveltejs/kit';
import { desc, eq, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export type TranslatorApplicationStatusFilter = 'all' | 'pending' | 'accepted' | 'rejected';

function parseStatusFilter(raw: string | null): TranslatorApplicationStatusFilter {
	if (raw === 'all' || raw === 'accepted' || raw === 'rejected') return raw;
	return 'pending';
}

export const load: PageServerLoad = async ({ locals, url }) => {
	await assertPermission(locals, 'translator_applications.review');

	const statusFilter = parseStatusFilter(url.searchParams.get('status'));
	const whereCondition =
		statusFilter === 'all' ? undefined : eq(table.translatorApplication.status, statusFilter);

	const baseQuery = db
		.select({
			id: table.translatorApplication.id,
			status: table.translatorApplication.status,
			explanation: table.translatorApplication.explanation,
			translatorName: table.translatorApplication.translatorName,
			adminNotes: table.translatorApplication.adminNotes,
			createdAt: table.translatorApplication.createdAt,
			applicant: {
				id: table.user.id,
				username: table.user.username,
				avatar: table.user.avatar,
				role: table.user.role
			},
			claimedTranslator: {
				id: table.translator.id,
				name: table.translator.name
			}
		})
		.from(table.translatorApplication)
		.leftJoin(table.user, eq(table.translatorApplication.userId, table.user.id))
		.leftJoin(
			table.translator,
			eq(table.translatorApplication.claimedTranslatorId, table.translator.id)
		);

	const applications = await (whereCondition ? baseQuery.where(whereCondition) : baseQuery).orderBy(
		desc(table.translatorApplication.createdAt)
	);

	return { applications, statusFilter };
};

export const actions: Actions = {
	updateStatus: async ({ request, locals }) => {
		await assertPermission(locals, 'translator_applications.review');

		const formData = await request.formData();
		const applicationId = formData.get('applicationId');
		const status = formData.get('status');
		const adminNotesRaw = formData.get('adminNotes');
		const adminNotes = typeof adminNotesRaw === 'string' ? adminNotesRaw.trim() : '';

		if (typeof applicationId !== 'string' || !applicationId.trim()) {
			return fail(400, { message: 'ID de candidature requis' });
		}
		if (status !== 'accepted' && status !== 'rejected') {
			return fail(400, { message: 'Statut invalide' });
		}
		if (status === 'rejected' && !adminNotes) {
			return fail(400, { message: 'Une note admin est obligatoire pour refuser une candidature' });
		}

		const [application] = await db
			.select({
				id: table.translatorApplication.id,
				userId: table.translatorApplication.userId,
				status: table.translatorApplication.status,
				claimedTranslatorId: table.translatorApplication.claimedTranslatorId,
				translatorName: table.translatorApplication.translatorName
			})
			.from(table.translatorApplication)
			.where(eq(table.translatorApplication.id, applicationId))
			.limit(1);

		if (!application) return fail(404, { message: 'Candidature non trouvée' });
		if (application.status !== 'pending') {
			return fail(400, { message: 'Seule une candidature en attente peut être traitée' });
		}

		if (status === 'accepted') {
			const [applicantUser] = await db
				.select({ role: table.user.role })
				.from(table.user)
				.where(eq(table.user.id, application.userId))
				.limit(1);
			if (!applicantUser) return fail(404, { message: 'Utilisateur non trouvé' });

			const alreadyHasTranslatorAccess = await hasPermissionForUser(
				applicantUser,
				'translations.own'
			);

			if (!alreadyHasTranslatorAccess) {
				const assignCheck = await assertCanAssignUserRole(locals, 'translator');
				if (!assignCheck.allowed) {
					return fail(403, { message: assignCheck.message });
				}
			}

			if (application.claimedTranslatorId) {
				await assignTranslatorUser(application.claimedTranslatorId, application.userId);
			} else if (application.translatorName) {
				const [existingTranslator] = await db
					.select({ id: table.translator.id, userId: table.translator.userId })
					.from(table.translator)
					.where(sql`lower(${table.translator.name}) = lower(${application.translatorName})`)
					.limit(1);
				if (existingTranslator?.userId && existingTranslator.userId !== application.userId) {
					return fail(409, {
						message: `Le nom de traducteur « ${application.translatorName} » est maintenant utilisé par un autre compte. Refusez la candidature ou faites revendiquer un profil existant.`
					});
				}
				const translatorId = existingTranslator
					? existingTranslator.id
					: await ensureTranslatorByName(application.translatorName);
				await assignTranslatorUser(translatorId, application.userId);
			}

			if (!alreadyHasTranslatorAccess) {
				await db
					.update(table.user)
					.set({ role: 'translator' })
					.where(eq(table.user.id, application.userId));
			}
		}

		await db
			.update(table.translatorApplication)
			.set({
				status,
				adminNotes: adminNotes || null,
				reviewedByUserId: locals.user!.id,
				updatedAt: new Date()
			})
			.where(eq(table.translatorApplication.id, applicationId));

		invalidatePendingTranslatorApplicationsCountCache();

		await notifyTranslatorApplicationStatusChange(
			application.userId,
			applicationId,
			status,
			adminNotes || null
		).catch((error) => {
			console.error('Erreur notification statut candidature traducteur:', error);
		});

		return { success: true, message: 'Candidature mise à jour' };
	}
};
