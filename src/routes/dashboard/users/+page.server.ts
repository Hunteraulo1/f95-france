import { SYSTEM_ROLE_LABELS } from '$lib/permissions/catalog';
import { formatUserEmailForDisplay } from '$lib/permissions/user-email';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { assertPermission, hasPermission, listAppRoles, roleExists } from '$lib/server/permissions';
import { assignTranslatorUser, unlinkUserFromTranslators } from '$lib/server/translator-user-link';
import {
	assertCanAssignUserRole,
	assertCanManageUserWithRole,
	listRolesAssignableToUsers
} from '$lib/server/user-role-assignment-guard';
import { fail } from '@sveltejs/kit';
import { and, eq, ne, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ locals, url }) => {
	await assertPermission(locals, 'users.manage');

	const canViewUserEmails = hasPermission(locals, 'users.view_email');

	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

	const [totalUsersResult, translatorsList] = await Promise.all([
		db.select({ count: sql<number>`count(*)`.as('count') }).from(table.user),
		db
			.select({
				id: table.translator.id,
				name: table.translator.name,
				userId: table.translator.userId
			})
			.from(table.translator)
			.orderBy(table.translator.name)
	]);

	const totalUsers = Number(totalUsersResult[0]?.count ?? 0);
	const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
	const page = Math.min(requestedPage, totalPages);

	const users = await db
		.select({
			id: table.user.id,
			username: table.user.username,
			email: table.user.email,
			role: table.user.role,
			avatar: table.user.avatar,
			createdAt: table.user.createdAt,
			lastConnectionAt:
				sql<Date | null>`(select max(${table.apiLog.createdAt}) from ${table.apiLog} where ${table.apiLog.userId} = ${table.user.id})`.as(
					'last_connection_at'
				)
		})
		.from(table.user)
		.orderBy(table.user.createdAt)
		.limit(PAGE_SIZE)
		.offset((page - 1) * PAGE_SIZE);

	const now = new Date();
	const usersWithLiveLastConnection = users.map((u) =>
		u.id === locals.user?.id
			? {
					...u,
					lastConnectionAt: now
				}
			: u
	);

	const appRoles = await listAppRoles();
	const roles = await listRolesAssignableToUsers(
		locals,
		appRoles.map((r) => ({
			slug: r.slug,
			label: SYSTEM_ROLE_LABELS[r.slug] ?? r.label,
			isSystem: r.isSystem
		}))
	);

	const usersForClient = usersWithLiveLastConnection.map((u) => ({
		...u,
		email: formatUserEmailForDisplay(u.email, canViewUserEmails)
	}));

	return {
		users: usersForClient,
		translators: translatorsList,
		roles,
		canViewUserEmails,
		canAssignAdmin: hasPermission(locals, 'users.assign_admin'),
		totalUsers,
		page,
		pageSize: PAGE_SIZE,
		totalPages
	};
};

export const actions: Actions = {
	updateUser: async ({ request, locals }) => {
		await assertPermission(locals, 'users.manage');

		const canViewUserEmails = hasPermission(locals, 'users.view_email');

		const formData = await request.formData();
		const userId = formData.get('userId') as string;
		const username = formData.get('username') as string;
		const emailRaw = formData.get('email');
		const email = typeof emailRaw === 'string' ? emailRaw.trim() : '';
		const role = formData.get('role') as string;
		const avatar = formData.get('avatar') as string;
		const linkedTranslatorRaw = formData.get('linkedTranslatorId');
		const linkedTranslatorId =
			typeof linkedTranslatorRaw === 'string' && linkedTranslatorRaw.trim()
				? linkedTranslatorRaw.trim()
				: '';

		if (!userId || !username || !role) {
			return fail(400, { message: 'Tous les champs requis sont manquants' });
		}

		if (canViewUserEmails && !email) {
			return fail(400, { message: 'L’adresse email est requise' });
		}

		if (!(await roleExists(role))) {
			return fail(400, { message: 'Rôle invalide' });
		}

		try {
			const duplicateUsername = await db
				.select({ id: table.user.id })
				.from(table.user)
				.where(and(eq(table.user.username, username), ne(table.user.id, userId)))
				.limit(1);
			if (duplicateUsername[0]) {
				return fail(409, { message: `Un utilisateur avec le nom "${username}" existe déjà` });
			}

			const currentUser = await db
				.select({
					role: table.user.role,
					email: table.user.email
				})
				.from(table.user)
				.where(eq(table.user.id, userId))
				.limit(1);

			if (!currentUser[0]) {
				return fail(404, { message: 'Utilisateur non trouvé' });
			}

			const currentUserRole = currentUser[0].role;
			const emailToSave = canViewUserEmails ? email : currentUser[0].email;

			const manageCheck = await assertCanManageUserWithRole(locals, currentUserRole, userId);
			if (!manageCheck.allowed) {
				return fail(403, { message: manageCheck.message });
			}

			if (role !== currentUserRole) {
				const assignCheck = await assertCanAssignUserRole(locals, role);
				if (!assignCheck.allowed) {
					return fail(403, { message: assignCheck.message });
				}
			}

			await db
				.update(table.user)
				.set({
					username,
					email: emailToSave,
					role,
					avatar: avatar || ''
				})
				.where(eq(table.user.id, userId));

			if (linkedTranslatorId) {
				const tr = await db
					.select({ id: table.translator.id })
					.from(table.translator)
					.where(eq(table.translator.id, linkedTranslatorId))
					.limit(1);
				if (!tr[0]) {
					return fail(400, { message: 'Profil traducteur introuvable' });
				}
				await assignTranslatorUser(linkedTranslatorId, userId);
			} else {
				await unlinkUserFromTranslators(userId);
			}

			return { success: true, message: 'Utilisateur mis à jour avec succès' };
		} catch (error: unknown) {
			console.error("Erreur lors de la mise à jour de l'utilisateur:", error);

			const mysqlError =
				error && typeof error === 'object' && 'cause' in error
					? (error.cause as { code?: string; errno?: number; sqlMessage?: string })
					: null;

			if (mysqlError && (mysqlError.code === 'ER_DUP_ENTRY' || mysqlError.errno === 1062)) {
				if (mysqlError.sqlMessage?.includes('username')) {
					return fail(409, { message: `Un utilisateur avec le nom "${username}" existe déjà` });
				}
				if (mysqlError.sqlMessage?.includes('email')) {
					return fail(409, { message: `Un utilisateur avec l'email "${email}" existe déjà` });
				}
				return fail(409, { message: 'Cet utilisateur existe déjà' });
			}

			return fail(500, { message: "Erreur lors de la mise à jour de l'utilisateur" });
		}
	}
};
