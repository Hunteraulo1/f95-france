import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const DEV_IMPERSONATION_ORIGIN_COOKIE = 'dev-impersonation-origin-user-id';

export const load: PageServerLoad = async ({ locals, cookies }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		throw new Error('Non authentifié');
	}

	const devUsers =
		locals.user.role === 'superadmin'
			? await db
					.select({
						id: table.user.id,
						username: table.user.username,
						role: table.user.role
					})
					.from(table.user)
			: [];

	const devOriginUserId = cookies.get(DEV_IMPERSONATION_ORIGIN_COOKIE);
	const canReturnToOwnAccount = Boolean(devOriginUserId);
	const [devOriginUser] =
		devOriginUserId && canReturnToOwnAccount
			? await db
					.select({ id: table.user.id, username: table.user.username, role: table.user.role })
					.from(table.user)
					.where(eq(table.user.id, devOriginUserId))
					.limit(1)
			: [];

	return {
		user: locals.user,
		devUsers,
		canReturnToOwnAccount: Boolean(canReturnToOwnAccount && devOriginUser),
		devOriginUsername: devOriginUser?.username ?? null
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, locals }) => {
		// Vérifier que l'utilisateur est authentifié
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}

		const formData = await request.formData();
		const username = formData.get('username') as string;
		const avatar = formData.get('avatar') as string;

		if (!username) {
			return fail(400, { message: "Le nom d'utilisateur est requis" });
		}

		try {
			await db
				.update(table.user)
				.set({
					username,
					avatar: avatar || ''
				})
				.where(eq(table.user.id, locals.user.id));

			return { success: true, message: 'Profil mis à jour avec succès' };
		} catch (error: unknown) {
			console.error('Erreur lors de la mise à jour du profil:', error);

			const mysqlError =
				error && typeof error === 'object' && 'cause' in error
					? (error.cause as { code?: string; errno?: number; sqlMessage?: string })
					: null;

			if (mysqlError && (mysqlError.code === 'ER_DUP_ENTRY' || mysqlError.errno === 1062)) {
				if (mysqlError.sqlMessage?.includes('username')) {
					return fail(409, { message: `Un utilisateur avec le nom "${username}" existe déjà` });
				}
				return fail(409, { message: "Ce nom d'utilisateur existe déjà" });
			}

			return fail(500, { message: 'Erreur lors de la mise à jour du profil' });
		}
	},

	updateTheme: async ({ request, locals }) => {
		// Vérifier que l'utilisateur est authentifié
		if (!locals.user) {
			return fail(401, { message: 'Non authentifié' });
		}

		const formData = await request.formData();
		const theme = formData.get('theme') as string;

		if (!theme || !['system', 'light', 'dark'].includes(theme)) {
			return fail(400, { message: 'Thème invalide' });
		}

		try {
			await db
				.update(table.user)
				.set({
					theme: theme as 'system' | 'light' | 'dark'
				})
				.where(eq(table.user.id, locals.user.id));

			return { success: true, message: 'Thème mis à jour avec succès' };
		} catch (error: unknown) {
			console.error('Erreur lors de la mise à jour du thème:', error);
			return fail(500, { message: 'Erreur lors de la mise à jour du thème' });
		}
	},

	updateDirectMode: async ({ request, locals }) => {
		// Vérifier que l'utilisateur est authentifié et est superadmin
		if (!locals.user || locals.user.role !== 'superadmin') {
			return fail(403, { message: 'Accès non autorisé' });
		}

		const formData = await request.formData();
		// Les checkboxes n'envoient rien si elles ne sont pas cochées
		const directMode = formData.has('directMode') && formData.get('directMode') !== 'false';

		try {
			await db
				.update(table.user)
				.set({
					directMode
				})
				.where(eq(table.user.id, locals.user.id));

			return { success: true, message: 'Mode direct mis à jour avec succès' };
		} catch (error: unknown) {
			console.error('Erreur lors de la mise à jour du mode direct:', error);
			return fail(500, { message: 'Erreur lors de la mise à jour du mode direct' });
		}
	},

	switchDevUser: async ({ request, locals, cookies, url }) => {
		if (!locals.user || locals.user.role !== 'superadmin') {
			return fail(403, { message: 'Accès non autorisé' });
		}
		if (!locals.session?.id) {
			return fail(401, { message: 'Session introuvable' });
		}

		const formData = await request.formData();
		const targetUserId = String(formData.get('targetUserId') ?? '').trim();
		if (!targetUserId) {
			return fail(400, { message: 'Utilisateur cible requis' });
		}

		const [targetUser] = await db
			.select({
				id: table.user.id,
				username: table.user.username
			})
			.from(table.user)
			.where(eq(table.user.id, targetUserId))
			.limit(1);

		if (!targetUser) {
			return fail(404, { message: 'Utilisateur introuvable' });
		}

		try {
			const existingOrigin = cookies.get(DEV_IMPERSONATION_ORIGIN_COOKIE);
			if (!existingOrigin) {
				cookies.set(DEV_IMPERSONATION_ORIGIN_COOKIE, locals.user.id, {
					path: '/',
					httpOnly: true,
					sameSite: 'lax',
					secure: url.protocol === 'https:',
					maxAge: 60 * 60 * 24 * 30
				});
			}

			await db
				.update(table.session)
				.set({ userId: targetUser.id })
				.where(eq(table.session.id, locals.session.id));

			return {
				success: true,
				message: `Session basculée vers ${targetUser.username}`
			};
		} catch (error: unknown) {
			console.error("Erreur lors du changement d'utilisateur (dev):", error);
			return fail(500, { message: "Erreur lors du changement d'utilisateur" });
		}
	},

	returnToOwnAccount: async ({ locals, cookies }) => {
		if (!locals.session?.id) {
			return fail(401, { message: 'Session introuvable' });
		}

		const originUserId = cookies.get(DEV_IMPERSONATION_ORIGIN_COOKIE);
		if (!originUserId) {
			return fail(400, { message: "Aucun compte d'origine à restaurer" });
		}

		const [originUser] = await db
			.select({ id: table.user.id, username: table.user.username, role: table.user.role })
			.from(table.user)
			.where(eq(table.user.id, originUserId))
			.limit(1);

		if (!originUser || originUser.role !== 'superadmin') {
			return fail(403, { message: "Le compte d'origine est invalide ou n'est pas superadmin" });
		}

		try {
			await db
				.update(table.session)
				.set({ userId: originUser.id })
				.where(eq(table.session.id, locals.session.id));
			cookies.delete(DEV_IMPERSONATION_ORIGIN_COOKIE, { path: '/' });
			return { success: true, message: `Retour sur ${originUser.username}` };
		} catch (error: unknown) {
			console.error("Erreur lors du retour au compte d'origine:", error);
			return fail(500, { message: "Erreur lors du retour au compte d'origine" });
		}
	}
};
