import {
	effectiveTranslationVersion,
	isTranslationOutdatedForLinkedTranslator
} from '$lib/server/api/translation-public';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { voidSyncTranslationToGoogleSheet } from '$lib/server/google-sheets-sync';
import { fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const FILTER_COOKIE_PATH = '/dashboard/my-translations';
const FILTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 an
const PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	if (!locals.user) {
		redirect(303, '/dashboard/login');
	}

	// Le compte doit être lié à un traducteur (translator.userId) pour que "Mes traductions" ait du sens.
	const [linkedTranslator] = await db
		.select({ id: table.translator.id, name: table.translator.name })
		.from(table.translator)
		.where(eq(table.translator.userId, locals.user.id))
		.limit(1);

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
	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	if (!linkedTranslator) {
		return {
			linkedTranslator: null,
			statusFilter,
			roleFilter,
			q,
			page: 1,
			pageSize: PAGE_SIZE,
			totalCount: 0,
			totalPages: 1,
			translations: []
		};
	}

	const whereStatus =
		statusFilter === 'all' ? undefined : eq(table.gameTranslation.status, statusFilter);

	const whereRole =
		roleFilter === 'translator'
			? eq(table.gameTranslation.translatorId, linkedTranslator.id)
			: roleFilter === 'proofreader'
				? eq(table.gameTranslation.proofreaderId, linkedTranslator.id)
				: or(
						eq(table.gameTranslation.translatorId, linkedTranslator.id),
						eq(table.gameTranslation.proofreaderId, linkedTranslator.id)
					);

	// Échappe les jokers SQL dans le terme de recherche pour utiliser ilike littéralement.
	const whereSearch = q
		? ilike(table.game.name, `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`)
		: undefined;

	const translations = await db
		.select({
			id: table.gameTranslation.id,
			translationName: table.gameTranslation.translationName,
			status: table.gameTranslation.status,
			version: table.gameTranslation.version,
			tversion: table.gameTranslation.tversion,
			tname: table.gameTranslation.tname,
			ttype: table.gameTranslation.ttype,
			tlink: table.gameTranslation.tlink,
			ac: table.gameTranslation.ac,
			updatedAt: table.gameTranslation.updatedAt,
			translatorId: table.gameTranslation.translatorId,
			translatorAlertsEnabled: table.gameTranslation.translatorAlertsEnabled,
			proofreaderId: table.gameTranslation.proofreaderId,
			game: {
				id: table.game.id,
				name: table.game.name,
				image: table.game.image,
				website: table.game.website,
				gameVersion: table.game.gameVersion
			}
		})
		.from(table.gameTranslation)
		.innerJoin(table.game, eq(table.game.id, table.gameTranslation.gameId))
		.where(
			and(whereRole, ...(whereStatus ? [whereStatus] : []), ...(whereSearch ? [whereSearch] : []))
		)
		.orderBy(desc(table.gameTranslation.updatedAt));

	const translationsWithFlags = translations
		.map((t) => {
			const referenceVersion = effectiveTranslationVersion(t.version, t.game.gameVersion) ?? '';
			const isOutdated = isTranslationOutdatedForLinkedTranslator(
				{
					status: t.status,
					version: t.version,
					tversion: t.tversion,
					tname: t.tname,
					translatorId: t.translatorId,
					translatorAlertsEnabled: t.translatorAlertsEnabled,
					proofreaderId: t.proofreaderId
				},
				t.game.gameVersion,
				linkedTranslator.id
			);
			const isFollowAbandoned =
				t.translatorId === linkedTranslator.id && !t.translatorAlertsEnabled;
			const canMuteTranslatorAlerts =
				t.translatorId === linkedTranslator.id && t.translatorAlertsEnabled;
			const canResumeTranslatorAlerts = isFollowAbandoned;
			return {
				...t,
				referenceVersion,
				isOutdated,
				isFollowAbandoned,
				canMuteTranslatorAlerts,
				canResumeTranslatorAlerts
			};
		})
		.sort((a, b) => {
			if (a.isFollowAbandoned !== b.isFollowAbandoned) return a.isFollowAbandoned ? 1 : -1;
			if (a.isOutdated !== b.isOutdated) return a.isOutdated ? -1 : 1;
			return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
		});

	const totalCount = translationsWithFlags.length;
	const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
	const page = Math.min(requestedPage, totalPages);
	const pageItems = translationsWithFlags.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	const staffIds = Array.from(
		new Set(
			pageItems
				.flatMap((t) => [t.translatorId, t.proofreaderId])
				.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
		)
	);
	const staffRows = staffIds.length
		? await db
				.select({
					id: table.translator.id,
					name: table.translator.name,
					username: table.user.username
				})
				.from(table.translator)
				.leftJoin(table.user, eq(table.user.id, table.translator.userId))
				.where(inArray(table.translator.id, staffIds))
		: [];
	const staffById = Object.fromEntries(
		staffRows.map((r) => [r.id, { name: r.name, username: r.username ?? null }])
	);

	return {
		linkedTranslator,
		statusFilter,
		roleFilter,
		q,
		page,
		pageSize: PAGE_SIZE,
		totalCount,
		totalPages,
		staffById,
		outdatedCount: translationsWithFlags.filter((t) => t.isOutdated).length,
		translations: pageItems
	};
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
