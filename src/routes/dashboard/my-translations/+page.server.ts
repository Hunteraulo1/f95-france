import { loadDashboardMyTranslationsPage } from '$lib/server/dashboard-my-translations-page-load';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { voidSyncTranslationToGoogleSheet } from '$lib/server/google-sheets-sync';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const FILTER_COOKIE_PATH = '/dashboard/my-translations';
const FILTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	if (!locals.user) {
		redirect(303, '/dashboard/account/login');
	}

	const statusFilterRaw = (
		url.searchParams.get('status') ??
		cookies.get('mt_status') ??
		'all'
	).trim();
	const statusFilter =
		statusFilterRaw === 'in_progress' ||
		statusFilterRaw === 'completed' ||
		statusFilterRaw === 'abandoned'
			? statusFilterRaw
			: 'all';

	const roleFilterRaw = (url.searchParams.get('role') ?? cookies.get('mt_role') ?? 'all').trim();
	const roleFilter =
		roleFilterRaw === 'translator' || roleFilterRaw === 'proofreader' ? roleFilterRaw : 'all';

	const cookieOptions = {
		path: FILTER_COOKIE_PATH,
		maxAge: FILTER_COOKIE_MAX_AGE,
		sameSite: 'lax' as const,
		httpOnly: true,
		secure: url.protocol === 'https:'
	};
	cookies.set('mt_status', statusFilter, cookieOptions);
	cookies.set('mt_role', roleFilter, cookieOptions);

	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);

	return loadDashboardMyTranslationsPage({
		locals,
		filters: { statusFilter, roleFilter, q },
		requestedPage: 1
	});
};

async function loadLinkedTranslatorForUser(userId: string) {
	const [row] = await db
		.select({ id: table.translator.id })
		.from(table.translator)
		.where(eq(table.translator.userId, userId))
		.limit(1);
	return row ?? null;
}

async function loadTranslationForTranslatorFollow(userId: string, translationId: string) {
	const linkedTranslator = await loadLinkedTranslatorForUser(userId);
	if (!linkedTranslator) {
		return fail(403, { message: 'Aucun traducteur lié à ce compte.' });
	}
	if (!translationId) {
		return fail(400, { message: 'Traduction introuvable.' });
	}

	const [translation] = await db
		.select({
			id: table.gameTranslation.id,
			translatorId: table.gameTranslation.translatorId,
			translatorAlertsEnabled: table.gameTranslation.translatorAlertsEnabled
		})
		.from(table.gameTranslation)
		.where(eq(table.gameTranslation.id, translationId))
		.limit(1);

	if (!translation) {
		return fail(404, { message: 'Traduction introuvable.' });
	}

	if (translation.translatorId !== linkedTranslator.id) {
		return fail(403, {
			message: 'Seul le traducteur assigné peut gérer le suivi sur cette ligne.'
		});
	}

	return { translationId, translation };
}

export const actions: Actions = {
	abandonTranslation: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}

		const translationId = String((await request.formData()).get('translationId') ?? '').trim();
		const ctx = await loadTranslationForTranslatorFollow(locals.user.id, translationId);
		if ('status' in ctx) return ctx;

		if (!ctx.translation.translatorAlertsEnabled) {
			return { success: true, message: 'Vous avez déjà abandonné le suivi de cette traduction.' };
		}

		await db
			.update(table.gameTranslation)
			.set({
				translatorAlertsEnabled: false,
				updatedAt: new Date()
			})
			.where(eq(table.gameTranslation.id, ctx.translationId));

		voidSyncTranslationToGoogleSheet(ctx.translationId, 'my-translations/abandon');

		return {
			success: true,
			message:
				'Traduction abandonnée pour vous : plus d’alertes. Le statut sur la fiche jeu est inchangé.'
		};
	},

	resumeTranslation: async ({ request, locals }) => {
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}

		const translationId = String((await request.formData()).get('translationId') ?? '').trim();
		const ctx = await loadTranslationForTranslatorFollow(locals.user.id, translationId);
		if ('status' in ctx) return ctx;

		if (ctx.translation.translatorAlertsEnabled) {
			return { success: true, message: 'Vous suivez déjà cette traduction.' };
		}

		await db
			.update(table.gameTranslation)
			.set({
				translatorAlertsEnabled: true,
				updatedAt: new Date()
			})
			.where(eq(table.gameTranslation.id, ctx.translationId));

		voidSyncTranslationToGoogleSheet(ctx.translationId, 'my-translations/resume');

		return {
			success: true,
			message:
				'Suivi repris : vous serez de nouveau alerté des mises à jour. Le statut sur la fiche jeu est inchangé.'
		};
	}
};
