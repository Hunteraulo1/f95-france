import * as auth from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/dashboard/login');
	}

	return {
		user: locals.user
	};
};

export const actions: Actions = {
	logout: async (event: RequestEvent) => {
		// Vérifier qu'il y a une session active
		if (!event.locals.session) {
			return fail(401, {
				message: 'Aucune session active'
			});
		}

		try {
			// Invalider la session dans la base de données
			await auth.invalidateSession(event.locals.session.id);

			// Supprimer le cookie de session
			auth.deleteSessionTokenCookie(event);

			// Rediriger vers la page de login
			throw redirect(302, '/dashboard/login');
		} catch (error) {
			// Si c'est une redirection, la laisser passer
			if (error && typeof error === 'object' && 'status' in error && error.status === 302) {
				throw error;
			}

			console.error('Erreur lors de la déconnexion:', error);
			return fail(500, {
				message: 'Une erreur est survenue lors de la déconnexion. Veuillez réessayer.'
			});
		}
	}
};
