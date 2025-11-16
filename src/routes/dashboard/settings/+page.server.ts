import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Vérifier que l'utilisateur est authentifié
	if (!locals.user) {
		throw new Error('Non authentifié');
	}

	return {
		user: locals.user
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
			return fail(400, { message: 'Le nom d\'utilisateur est requis' });
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
			
			const mysqlError = error && typeof error === 'object' && 'cause' in error 
				? error.cause as { code?: string; errno?: number; sqlMessage?: string }
				: null;
			
			if (mysqlError && (mysqlError.code === 'ER_DUP_ENTRY' || mysqlError.errno === 1062)) {
				if (mysqlError.sqlMessage?.includes('username')) {
					return fail(409, { message: `Un utilisateur avec le nom "${username}" existe déjà` });
				}
				return fail(409, { message: 'Ce nom d\'utilisateur existe déjà' });
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
	}
};
