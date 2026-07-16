import { assertDashboardAuthenticated } from '$lib/server/dashboard-auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { userHasLinkedTranslator } from '$lib/server/linked-translator';
import { notifyNewTranslatorApplication } from '$lib/server/notifications';
import { sendDiscordWebhookAdminNewTranslatorApplication } from '$lib/server/discord-webhook';
import { invalidatePendingTranslatorApplicationsCountCache } from '$lib/server/pending-translator-applications-count';
import { fail } from '@sveltejs/kit';
import { and, desc, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	assertDashboardAuthenticated(locals);

	const alreadyLinked = await userHasLinkedTranslator(locals.user!.id);
	const hasDiscordLinked = Boolean(locals.user!.discordId);

	if (alreadyLinked) {
		return { alreadyLinked, hasDiscordLinked, username: locals.user!.username, application: null };
	}

	const [application] = await db
		.select({
			id: table.translatorApplication.id,
			status: table.translatorApplication.status,
			explanation: table.translatorApplication.explanation,
			translatorName: table.translatorApplication.translatorName,
			claimedTranslatorId: table.translatorApplication.claimedTranslatorId,
			adminNotes: table.translatorApplication.adminNotes,
			createdAt: table.translatorApplication.createdAt
		})
		.from(table.translatorApplication)
		.where(eq(table.translatorApplication.userId, locals.user!.id))
		.orderBy(desc(table.translatorApplication.createdAt))
		.limit(1);

	return {
		alreadyLinked,
		hasDiscordLinked,
		username: locals.user!.username,
		application: application ?? null
	};
};

export const actions: Actions = {
	submit: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Non authentifié' });
		if (await userHasLinkedTranslator(locals.user.id)) {
			return fail(400, { message: 'Vous avez déjà un profil traducteur lié à ce compte' });
		}
		if (!locals.user.discordId) {
			return fail(400, {
				message: 'Vous devez lier votre compte Discord avant de postuler (Paramètres → Discord)'
			});
		}

		const formData = await request.formData();
		const explanation = String(formData.get('explanation') ?? '').trim();
		const claimedTranslatorIdRaw = String(formData.get('claimedTranslatorId') ?? '').trim();
		const translatorNameRaw = String(formData.get('translatorName') ?? '').trim();

		const [existingPending] = await db
			.select({ id: table.translatorApplication.id })
			.from(table.translatorApplication)
			.where(
				and(
					eq(table.translatorApplication.userId, locals.user.id),
					eq(table.translatorApplication.status, 'pending')
				)
			)
			.limit(1);
		if (existingPending) {
			return fail(400, { message: 'Une candidature est déjà en attente' });
		}

		let claimedTranslatorId: string | null = null;
		let claimedTranslatorName: string | null = null;
		let translatorName: string | null = null;

		if (claimedTranslatorIdRaw) {
			const [claimed] = await db
				.select({
					id: table.translator.id,
					name: table.translator.name,
					userId: table.translator.userId
				})
				.from(table.translator)
				.where(eq(table.translator.id, claimedTranslatorIdRaw))
				.limit(1);
			if (!claimed) {
				return fail(400, { message: 'Profil traducteur introuvable' });
			}
			if (claimed.userId) {
				return fail(400, { message: 'Ce profil traducteur est déjà lié à un compte' });
			}
			claimedTranslatorId = claimed.id;
			claimedTranslatorName = claimed.name;
		} else {
			translatorName = translatorNameRaw || locals.user.username;

			const [existingTranslator] = await db
				.select({ id: table.translator.id })
				.from(table.translator)
				.where(sql`lower(${table.translator.name}) = lower(${translatorName})`)
				.limit(1);
			if (existingTranslator) {
				return fail(400, {
					message:
						'Ce nom de traducteur est déjà utilisé. Choisissez un autre nom, ou revendiquez le profil existant.'
				});
			}
		}

		const applicationId = randomUUID();
		await db.insert(table.translatorApplication).values({
			id: applicationId,
			userId: locals.user.id,
			explanation: explanation || null,
			translatorName,
			claimedTranslatorId
		});

		await notifyNewTranslatorApplication(applicationId, locals.user.username).catch((error) => {
			console.error('Erreur notification nouvelle candidature traducteur:', error);
		});
		invalidatePendingTranslatorApplicationsCountCache();

		void sendDiscordWebhookAdminNewTranslatorApplication({
			applicantUsername: locals.user.username,
			explanation: explanation || null,
			claimedTranslatorName,
			translatorName
		});

		return { success: true, message: 'Candidature envoyée avec succès' };
	},

	cancel: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Non authentifié' });

		const formData = await request.formData();
		const applicationId = formData.get('applicationId');
		if (typeof applicationId !== 'string' || !applicationId.trim()) {
			return fail(400, { message: 'ID de candidature requis' });
		}

		const [application] = await db
			.select({
				id: table.translatorApplication.id,
				userId: table.translatorApplication.userId,
				status: table.translatorApplication.status
			})
			.from(table.translatorApplication)
			.where(eq(table.translatorApplication.id, applicationId))
			.limit(1);

		if (!application) return fail(404, { message: 'Candidature non trouvée' });
		if (application.userId !== locals.user.id) return fail(403, { message: 'Accès non autorisé' });
		if (application.status !== 'pending') {
			return fail(400, { message: 'Seule une candidature en attente peut être annulée' });
		}

		await db
			.update(table.translatorApplication)
			.set({
				status: 'rejected',
				adminNotes: 'Annulée par l’utilisateur',
				updatedAt: new Date()
			})
			.where(eq(table.translatorApplication.id, applicationId));

		invalidatePendingTranslatorApplicationsCountCache();

		return { success: true };
	}
};
