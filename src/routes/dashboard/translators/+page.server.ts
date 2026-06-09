import { formatUserEmailForDisplay } from '$lib/permissions/user-email';
import { assertDashboardAuthenticated } from '$lib/server/dashboard-auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { getDiscordAvatarUrl } from '$lib/server/discord-oauth';
import { assertPermission, hasPermission } from '$lib/server/permissions';
import { getRoleEditMode } from '$lib/server/role-edit-mode';
import {
	handleTranslatorPagesUpdate,
	resolveTranslatorPagesWriteMode
} from '$lib/server/translator-pages-write';
import { assignTranslatorUser } from '$lib/server/translator-user-link';
import { fail } from '@sveltejs/kit';
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const PAGE_SIZE = 20;

async function setUserAvatarFromDiscordIdIfMissing(userId: string, discordId: string | null) {
	const normalizedDiscordId = discordId?.trim();
	if (!normalizedDiscordId) return;

	const [currentUser] = await db
		.select({ avatar: table.user.avatar })
		.from(table.user)
		.where(eq(table.user.id, userId))
		.limit(1);

	if (!currentUser || currentUser.avatar.trim() !== '') return;

	try {
		const avatarUrl = await getDiscordAvatarUrl(normalizedDiscordId);
		if (!avatarUrl) return;

		await db.update(table.user).set({ avatar: avatarUrl }).where(eq(table.user.id, userId));
	} catch (error: unknown) {
		console.error("Erreur lors de la récupération de l'avatar Discord:", error);
	}
}

export const load: PageServerLoad = async ({ locals, url }) => {
	assertDashboardAuthenticated(locals);

	const canManageTranslators = hasPermission(locals, 'translators.manage');
	const canViewUserEmails = hasPermission(locals, 'users.view_email');
	const hasGamesManage = hasPermission(locals, 'games.manage');
	const roleEditMode = hasGamesManage ? await getRoleEditMode(locals.user.role) : null;

	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	const escapeIlike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

	const conditions = [];
	if (!canManageTranslators) {
		conditions.push(eq(table.translator.userId, locals.user.id));
	}
	if (q) {
		const pattern = `%${escapeIlike(q)}%`;
		conditions.push(
			or(ilike(table.translator.name, pattern), ilike(table.translator.discordId, pattern))
		);
	}
	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const countBase = db.select({ count: sql<number>`count(*)`.as('count') }).from(table.translator);
	const [countRow] = await (whereClause ? countBase.where(whereClause) : countBase);

	const totalCount = Number(countRow?.count ?? 0);
	const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
	const page = Math.min(requestedPage, totalPages);
	const offset = (page - 1) * PAGE_SIZE;

	const listBase = db
		.select({
			id: table.translator.id,
			name: table.translator.name,
			discordId: table.translator.discordId,
			pages: table.translator.pages,
			userId: table.translator.userId
		})
		.from(table.translator);
	const translators = await (whereClause ? listBase.where(whereClause) : listBase)
		.orderBy(table.translator.name)
		.limit(PAGE_SIZE)
		.offset(offset);

	const users = canManageTranslators
		? await db
				.select({
					id: table.user.id,
					username: table.user.username,
					email: table.user.email
				})
				.from(table.user)
				.orderBy(table.user.username)
		: [];

	const translatorsWithPages = translators.map((translator) => ({
		...translator,
		pages: JSON.parse(translator.pages || '[]')
	}));

	const translatorPagesWriteMode = await resolveTranslatorPagesWriteMode({
		hasGamesManage,
		roleSlug: locals.user.role,
		userDirectMode: locals.user.directMode ?? true
	});

	const usersForClient = users.map((u) => ({
		...u,
		email: formatUserEmailForDisplay(u.email, canViewUserEmails)
	}));

	return {
		translator: translatorsWithPages,
		users: usersForClient,
		canManageTranslators,
		canViewUserEmails,
		hasGamesManage,
		roleEditMode,
		translatorPagesWriteMode,
		directMode: locals.user.directMode ?? true,
		currentUserId: locals.user.id,
		q,
		page,
		pageSize: PAGE_SIZE,
		totalCount,
		totalPages
	};
};

export const actions: Actions = {
	addTranslator: async ({ request, locals }) => {
		await assertPermission(locals, 'translators.manage');
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const discordId = formData.get('discordId') as string;
		const pages = formData.get('pages') as string;
		const linkUserRaw = formData.get('userId');
		const linkUserId =
			typeof linkUserRaw === 'string' && linkUserRaw.trim() ? linkUserRaw.trim() : null;

		if (!name) {
			return fail(400, { message: 'Le nom est requis' });
		}

		try {
			if (linkUserId) {
				const userRow = await db
					.select({ id: table.user.id })
					.from(table.user)
					.where(eq(table.user.id, linkUserId))
					.limit(1);
				if (!userRow[0]) {
					return fail(400, { message: 'Utilisateur introuvable pour le lien' });
				}
			}

			const pagesArray = pages ? JSON.parse(pages) : [];

			const [created] = await db
				.insert(table.translator)
				.values({
					name,
					discordId: discordId || null,
					pages: JSON.stringify(pagesArray)
				})
				.returning({ id: table.translator.id });

			if (created && linkUserId) {
				await assignTranslatorUser(created.id, linkUserId);
				await setUserAvatarFromDiscordIdIfMissing(linkUserId, discordId || null);
			}

			return { success: true, message: 'Traducteur ajouté avec succès' };
		} catch (error: unknown) {
			console.error("Erreur lors de l'ajout du traducteur:", error);

			// Vérifier si c'est une erreur de duplication
			const mysqlError =
				error && typeof error === 'object' && 'cause' in error
					? (error.cause as { code?: string; errno?: number; sqlMessage?: string })
					: null;

			if (mysqlError && (mysqlError.code === 'ER_DUP_ENTRY' || mysqlError.errno === 1062)) {
				if (mysqlError.sqlMessage?.includes('translator_name_unique')) {
					return fail(409, { message: `Un traducteur avec le nom "${name}" existe déjà` });
				}
				if (mysqlError.sqlMessage?.includes('discord_id')) {
					return fail(409, { message: `Un traducteur avec cet ID Discord existe déjà` });
				}
				return fail(409, { message: 'Ce traducteur existe déjà' });
			}

			return fail(500, { message: "Erreur lors de l'ajout du traducteur" });
		}
	},

	editTranslator: async ({ request, locals }) => {
		await assertPermission(locals, 'translators.manage');
		const formData = await request.formData();
		const id = formData.get('id') as string;
		const name = formData.get('name') as string;
		const discordId = formData.get('discordId') as string;
		const pages = formData.get('pages') as string;
		const linkUserRaw = formData.get('userId');
		const linkUserId =
			typeof linkUserRaw === 'string' && linkUserRaw.trim() ? linkUserRaw.trim() : null;

		if (!id || !name) {
			return fail(400, { message: 'ID et nom requis' });
		}

		try {
			if (linkUserId) {
				const userRow = await db
					.select({ id: table.user.id })
					.from(table.user)
					.where(eq(table.user.id, linkUserId))
					.limit(1);
				if (!userRow[0]) {
					return fail(400, { message: 'Utilisateur introuvable pour le lien' });
				}
			}

			const pagesArray = pages ? JSON.parse(pages) : [];

			await db
				.update(table.translator)
				.set({
					name,
					discordId: discordId || null,
					pages: JSON.stringify(pagesArray)
				})
				.where(eq(table.translator.id, id));

			await assignTranslatorUser(id, linkUserId);
			if (linkUserId) {
				await setUserAvatarFromDiscordIdIfMissing(linkUserId, discordId || null);
			}

			return { success: true, message: 'Traducteur modifié avec succès' };
		} catch (error: unknown) {
			console.error('Erreur lors de la modification du traducteur:', error);

			// Vérifier si c'est une erreur de duplication
			const mysqlError =
				error && typeof error === 'object' && 'cause' in error
					? (error.cause as { code?: string; errno?: number; sqlMessage?: string })
					: null;

			if (mysqlError && (mysqlError.code === 'ER_DUP_ENTRY' || mysqlError.errno === 1062)) {
				if (mysqlError.sqlMessage?.includes('translator_name_unique')) {
					return fail(409, { message: `Un traducteur avec le nom "${name}" existe déjà` });
				}
				if (mysqlError.sqlMessage?.includes('discord_id')) {
					return fail(409, { message: `Un traducteur avec cet ID Discord existe déjà` });
				}
				return fail(409, { message: 'Ce traducteur existe déjà' });
			}

			return fail(500, { message: 'Erreur lors de la modification du traducteur' });
		}
	},
	requestTranslatorPagesUpdate: async (event) => {
		const hasGamesManage = hasPermission(event.locals, 'games.manage');
		const result = await handleTranslatorPagesUpdate(event, { hasGamesManage });
		if (!result.ok) {
			return fail(result.status, { message: result.message });
		}
		return { success: true, message: result.message, mode: result.mode };
	}
};
