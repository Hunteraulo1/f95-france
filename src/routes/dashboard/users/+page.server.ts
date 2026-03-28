import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { assignTranslatorUser, unlinkUserFromTranslators } from '$lib/server/translator-user-link';
import { fail } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
		throw new Error('Accès non autorisé');
	}

	const page = 1;
	const pageSize = 20;
	const [users, translatorsList, totalUsersResult] = await Promise.all([
		db
			.select({
				id: table.user.id,
				username: table.user.username,
				email: table.user.email,
				role: table.user.role,
				avatar: table.user.avatar,
				createdAt: table.user.createdAt
			})
			.from(table.user)
			.orderBy(table.user.createdAt)
			.limit(pageSize)
			.offset((page - 1) * pageSize),
		db
			.select({
				id: table.translator.id,
				name: table.translator.name,
				userId: table.translator.userId
			})
			.from(table.translator)
			.orderBy(table.translator.name),
		db.select({ count: sql<number>`count(*)`.as('count') }).from(table.user)
	]);

	const totalUsers = totalUsersResult[0]?.count || 0;

	return {
		users,
		translators: translatorsList,
		totalUsers,
		currentPage: page,
		pageSize
	};
};

export const actions: Actions = {
	updateUser: async ({ request, locals }) => {
		if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'superadmin')) {
			return fail(403, { message: 'Accès non autorisé' });
		}

		const formData = await request.formData();
		const userId = formData.get('userId') as string;
		const username = formData.get('username') as string;
		const email = formData.get('email') as string;
		const role = formData.get('role') as string;
		const avatar = formData.get('avatar') as string;
		const linkedTranslatorRaw = formData.get('linkedTranslatorId');
		const linkedTranslatorId =
			typeof linkedTranslatorRaw === 'string' && linkedTranslatorRaw.trim()
				? linkedTranslatorRaw.trim()
				: '';

		if (!userId || !username || !email || !role) {
			return fail(400, { message: 'Tous les champs sont requis' });
		}

		if (!['user', 'translator', 'admin', 'superadmin'].includes(role)) {
			return fail(400, { message: 'Rôle invalide' });
		}

		try {
			const currentUser = await db
				.select({
					role: table.user.role
				})
				.from(table.user)
				.where(eq(table.user.id, userId))
				.limit(1);

			if (!currentUser[0]) {
				return fail(404, { message: 'Utilisateur non trouvé' });
			}

			const currentUserRole = currentUser[0].role;

			if (role === 'superadmin' && locals.user.role !== 'superadmin') {
				return fail(403, { message: "Vous n'avez pas les permissions pour définir un superadmin" });
			}

			if (currentUserRole === 'superadmin' && locals.user.role !== 'superadmin') {
				return fail(403, {
					message: "Vous n'avez pas les permissions pour modifier un superadmin"
				});
			}

			await db
				.update(table.user)
				.set({
					username,
					email,
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
