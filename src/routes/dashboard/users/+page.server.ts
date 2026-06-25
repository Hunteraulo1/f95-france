import { assertPermission, hasPermission, roleExists } from '$lib/server/permissions';
import { loadDashboardUsersPage } from '$lib/server/dashboard-users-page-load';
import { sendPasswordResetEmailForUser } from '$lib/server/password-reset';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import {
	assertCanAssignUserRole,
	assertCanManageUserWithRole
} from '$lib/server/user-role-assignment-guard';
import { assignTranslatorUser, unlinkUserFromTranslators } from '$lib/server/translator-user-link';
import { fail } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	await assertPermission(locals, 'users.manage');

	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);

	return loadDashboardUsersPage({ locals, q, requestedPage: 1 });
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
			const emailChanged = canViewUserEmails && emailToSave !== currentUser[0].email;

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
					avatar: avatar || '',
					...(emailChanged ? { emailVerifiedAt: null } : {})
				})
				.where(eq(table.user.id, userId));

			if (emailChanged) {
				const { sendVerificationEmailForUser } = await import('$lib/server/email-verification');
				await sendVerificationEmailForUser(userId).catch((error) => {
					console.error('Erreur envoi email de vérification après changement email:', error);
				});
			}

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
	},

	sendPasswordReset: async ({ request, locals, url }) => {
		await assertPermission(locals, 'users.manage');

		const formData = await request.formData();
		const userId = formData.get('userId') as string;

		if (!userId) {
			return fail(400, { message: 'Utilisateur manquant' });
		}

		const [user] = await db
			.select({
				id: table.user.id,
				role: table.user.role,
				username: table.user.username
			})
			.from(table.user)
			.where(eq(table.user.id, userId))
			.limit(1);

		if (!user) {
			return fail(404, { message: 'Utilisateur non trouvé' });
		}

		const manageCheck = await assertCanManageUserWithRole(locals, user.role, userId);
		if (!manageCheck.allowed) {
			return fail(403, { message: manageCheck.message });
		}

		const result = await sendPasswordResetEmailForUser(userId, {
			requestOrigin: url.origin
		});

		if (result.ok) {
			return {
				success: true,
				message: `Un email de réinitialisation a été envoyé à ${user.username}.`
			};
		}

		switch (result.reason) {
			case 'cooldown':
				return fail(429, {
					message:
						'Un email de réinitialisation a déjà été envoyé récemment. Veuillez patienter 2 minutes.'
				});
			case 'send_failed':
				return fail(502, {
					message:
						'Impossible d’envoyer l’email pour le moment. Vérifiez la configuration SMTP ou réessayez plus tard.'
				});
			case 'user_not_found':
				return fail(404, { message: 'Utilisateur non trouvé' });
			default:
				return fail(500, { message: 'Erreur lors de l’envoi de l’email de réinitialisation' });
		}
	}
};
